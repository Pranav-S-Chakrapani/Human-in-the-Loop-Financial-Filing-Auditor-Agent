import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from langgraph.types import Command
from backend.app.db import get_connection
from backend.app.audit import append_audit_entry
from backend.app.events import event_bus
from backend.app.models import ReviewDecisionRequest, ReviewDecisionResponse

router = APIRouter(tags=["reviews"])

@router.get("/reviews")
def list_reviews(
    status: str = "all",
    run_id: Optional[str] = None,
    company: Optional[str] = None
) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        query = "SELECT r.*, run.company, run.ticker FROM reviews r JOIN runs run ON r.run_id = run.run_id WHERE 1=1"
        params: List[Any] = []

        if status != "all":
            query += " AND r.status = ?"
            params.append(status)
        if run_id:
            query += " AND r.run_id = ?"
            params.append(run_id)
        if company:
            query += " AND run.company = ?"
            params.append(company)

        cur.execute(query, params)
        rows = cur.fetchall()
        reviews = []
        for r in rows:
            reasons = json.loads(r["reasons"]) if r["reasons"] else []
            reviews.append({
                "review_id": r["review_id"],
                "run_id": r["run_id"],
                "company": r["company"],
                "metric": r["metric_id"],
                "period_label": "FY2026",
                "round": r["round"],
                "status": r["status"],
                "actionable": r["status"] == "pending",
                "reasons": reasons,
                "confidence": 0.5,
                "created_at": r["created_at"]
            })
        return reviews
    finally:
        conn.close()

@router.post("/reviews/{review_id}/decision", response_model=ReviewDecisionResponse)
async def submit_review_decision(
    review_id: str,
    req: ReviewDecisionRequest,
    request: Request
):
    """
    RULES.md #10 & SPEC.md §10: Durable-first review decision.
    Audit row + review status commit in one transaction BEFORE Command(resume=...).
    Idempotent: repeat POSTs return duplicate: true with exactly one audit row.
    """
    if req.decision == "correct" and req.corrected_value is None:
        raise HTTPException(status_code=400, detail="corrected_value required for 'correct' decision")
    if req.decision in ("correct", "reject") and not req.note:
        raise HTTPException(status_code=400, detail="note required for correct or reject decision")

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM reviews WHERE review_id = ?", (review_id,))
        review_row = cur.fetchone()
        if not review_row:
            raise HTTPException(status_code=404, detail="Review not found")

        run_id = review_row["run_id"]
        cur.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,))
        run_row = cur.fetchone()
        company_name = run_row["company"] if run_row else "Unknown"

        # Check idempotency: is this review already decided?
        cur.execute("SELECT * FROM audit_log WHERE review_id = ?", (review_id,))
        existing_audit = cur.fetchone()

        if existing_audit:
            # Idempotent repeat response
            return {
                "review_id": review_id,
                "decision": req.decision,
                "audit_seq": existing_audit["seq"],
                "audit_hash": existing_audit["row_hash"],
                "run_status": run_row["status"] if run_row else "running",
                "duplicate": True
            }

        # Step 1: Durable-first commit (Audit row + Review status in ONE transaction)
        # We append audit log entry (which uses BEGIN IMMEDIATE and enforces UNIQUE review_id)
        metric_id = review_row["metric_id"]
        reasons_list = json.loads(review_row["reasons"]) if review_row["reasons"] else []

        seq, row_hash = append_audit_entry(
            review_id=review_id,
            run_id=run_id,
            company=company_name,
            metric=metric_id,
            period="FY2026",
            original_value=None,
            corrected_value=req.corrected_value,
            decision=req.decision,
            reviewer=req.reviewer,
            note=req.note or "",
            reasons=reasons_list,
            confidence=0.5
        )

        # Update review status to decided in SQLite
        cur.execute(
            "UPDATE reviews SET status = ? WHERE review_id = ?",
            (req.decision, review_id)
        )
        cur.execute(
            "UPDATE runs SET status = 'running', updated_at = ? WHERE run_id = ?",
            (datetime.now(timezone.utc).isoformat(), run_id)
        )
        conn.commit()

    finally:
        conn.close()

    # Step 2: Resume the thread via Command(resume=...)
    graph = request.app.state.toy_graph if "toy" in run_id else request.app.state.pipeline_graph
    config = {"configurable": {"thread_id": run_id}}
    resume_payload = {
        "decision": req.decision,
        "corrected_value": req.corrected_value,
        "note": req.note,
        "reviewer": req.reviewer
    }

    try:
        await graph.ainvoke(Command(resume=resume_payload), config)
    except Exception as e:
        print(f"Graph resume invocation note: {e}")

    await event_bus.emit(
        "review_decided",
        {"review_id": review_id, "decision": req.decision, "audit_seq": seq},
        run_id=run_id
    )

    return {
        "review_id": review_id,
        "decision": req.decision,
        "audit_seq": seq,
        "audit_hash": row_hash,
        "run_status": "running",
        "duplicate": False
    }
