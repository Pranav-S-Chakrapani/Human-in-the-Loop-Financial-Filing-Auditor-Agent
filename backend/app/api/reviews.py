import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request
from langgraph.types import Command
from backend.app.db import get_connection
from backend.app.audit import append_audit_entry
from backend.app.adaptive import record_metric_decision
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

        query += " ORDER BY r.rowid ASC"

        cur.execute(query, params)
        rows = cur.fetchall()

        # Find head-of-queue per run for actionable flag (CONTRACT.md: actionable=true only for head-of-queue)
        head_by_run: Dict[str, str] = {}
        for r in rows:
            if r["status"] == "pending" and r["run_id"] not in head_by_run:
                head_by_run[r["run_id"]] = r["review_id"]

        reviews = []
        for r in rows:
            reasons = json.loads(r["reasons"]) if r["reasons"] else []
            is_actionable = (r["status"] == "pending" and head_by_run.get(r["run_id"]) == r["review_id"])

            cur.execute("SELECT confidence FROM metrics WHERE metric_id = ?", (r["metric_id"],))
            m_row = cur.fetchone()
            conf = m_row["confidence"] if m_row else 0.5

            reviews.append({
                "review_id": r["review_id"],
                "run_id": r["run_id"],
                "company": r["company"],
                "metric": r["metric_id"].replace(f"m_{r['run_id']}_", ""),
                "period_label": "FY2026",
                "round": r["round"],
                "status": r["status"],
                "actionable": is_actionable,
                "reasons": reasons,
                "confidence": conf,
                "created_at": r["created_at"]
            })
        return reviews
    finally:
        conn.close()

@router.get("/reviews/{review_id}")
def get_review_detail(review_id: str) -> Dict[str, Any]:
    """CONTRACT.md GET /reviews/{id}"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT r.*, run.company, run.ticker FROM reviews r JOIN runs run ON r.run_id = run.run_id WHERE r.review_id = ?", (review_id,))
        rev = cur.fetchone()
        if not rev:
            raise HTTPException(status_code=404, detail="Review not found")

        run_id = rev["run_id"]
        # Check actionable (head of queue)
        cur.execute("SELECT review_id FROM reviews WHERE run_id = ? AND status = 'pending' ORDER BY rowid ASC LIMIT 1", (run_id,))
        head_row = cur.fetchone()
        is_actionable = (rev["status"] == "pending" and head_row and head_row["review_id"] == review_id)

        # Metric data
        cur.execute("SELECT * FROM metrics WHERE metric_id = ?", (rev["metric_id"],))
        m = cur.fetchone()

        m_dict = None
        sr = None
        if m:
            try:
                cb = json.loads(m["confidence_breakdown"]) if m["confidence_breakdown"] else None
                sr = json.loads(m["source_ref"]) if m["source_ref"] else None
                gt = json.loads(m["ground_truth"]) if m["ground_truth"] else None
            except Exception:
                cb, sr, gt = None, None, None

            m_dict = {
                "metric_id": m["metric_id"],
                "run_id": m["run_id"],
                "metric": m["metric"],
                "period_label": m["period_label"],
                "period_end": m["period_end"],
                "is_current": bool(m["is_current"]),
                "unit_label": m["unit_label"],
                "scale": m["scale"],
                "value_a": m["value_a"],
                "value_b": m["value_b"],
                "value_dollars": m["value_dollars"],
                "snippet_text": m["snippet_text"],
                "snippet_html": m["snippet_html"],
                "source_ref": sr,
                "confidence": m["confidence"],
                "confidence_breakdown": cb,
                "method": m["method"],
                "decision_status": m["decision_status"],
                "final_value": m["final_value"],
                "fault_injected": bool(m["fault_injected"]),
                "ground_truth": gt
            }

        # Validations for this metric
        cur.execute("SELECT * FROM validations WHERE run_id = ?", (run_id,))
        v_rows = cur.fetchall()
        validations = []
        for v in v_rows:
            try:
                dt = json.loads(v["detail"]) if v["detail"] else {}
            except Exception:
                dt = {}
            validations.append({
                "validation_id": v["validation_id"],
                "check_type": v["check_type"],
                "metric": v["metric_id"].replace(f"m_{run_id}_", ""),
                "status": v["status"],
                "phase": v["phase"],
                "detail": dt,
                "explanation": v["explanation"]
            })

        # Statement HTML & highlight
        highlight = {"row": sr.get("row", 0) if sr else 0, "col": sr.get("col", 1) if sr else 1}
        stmt_html = m["snippet_html"] if m and m["snippet_html"] else "<table></table>"

        # Check audit log if already decided
        cur.execute("SELECT * FROM audit_log WHERE review_id = ?", (review_id,))
        audit_row = cur.fetchone()
        decision_val = audit_row["decision"] if audit_row else None

        reasons = json.loads(rev["reasons"]) if rev["reasons"] else []

        return {
            "review_id": review_id,
            "status": rev["status"],
            "actionable": is_actionable,
            "round": rev["round"],
            "metric": m_dict,
            "reasons": reasons,
            "validations": [v for v in validations if m_dict and v["metric"] == m_dict["metric"]],
            "statement_html": stmt_html,
            "highlight": highlight,
            "other_extractor": {
                "rules": m["value_a"] if m else None,
                "llm": m["value_b"] if m else None
            },
            "decision": decision_val
        }
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

        # Check actionable: is it head-of-queue? (409 if not actionable per CONTRACT.md)
        cur.execute("SELECT review_id FROM reviews WHERE run_id = ? AND status = 'pending' ORDER BY rowid ASC LIMIT 1", (run_id,))
        head_row = cur.fetchone()
        if head_row and head_row["review_id"] != review_id:
            raise HTTPException(status_code=409, detail="Review is not actionable (queued behind head of queue)")

        # Step 1: Durable-first commit (Audit row + Review status in ONE transaction)
        metric_id = review_row["metric_id"]
        reasons_list = json.loads(review_row["reasons"]) if review_row["reasons"] else []

        cur.execute("SELECT value_dollars, confidence FROM metrics WHERE metric_id = ?", (metric_id,))
        m_row = cur.fetchone()
        orig_val = m_row["value_dollars"] if m_row else None
        conf_val = m_row["confidence"] if m_row else 0.5

        seq, row_hash = append_audit_entry(
            review_id=review_id,
            run_id=run_id,
            company=company_name,
            metric=metric_id.replace(f"m_{run_id}_", ""),
            period="FY2026",
            original_value=orig_val,
            corrected_value=req.corrected_value,
            decision=req.decision,
            reviewer=req.reviewer,
            note=req.note or "",
            reasons=reasons_list,
            confidence=conf_val
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

        # Update adaptive thresholds count for corrected or rejected values
        metric_name = metric_id.replace(f"m_{run_id}_", "")
        record_metric_decision(metric_name, req.decision)

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
        state = await graph.aget_state(config)
        conn = get_connection()
        try:
            cur = conn.cursor()
            now_iso = datetime.now(timezone.utc).isoformat()
            if state.next:
                cur.execute("UPDATE runs SET status = 'paused', current_node = ?, updated_at = ? WHERE run_id = ?", (state.next[0], now_iso, run_id))
                conn.commit()
                await event_bus.emit("run_paused", {"node": state.next[0]}, run_id=run_id)
            else:
                cur.execute("UPDATE runs SET status = 'completed', current_node = 'done', updated_at = ? WHERE run_id = ?", (now_iso, run_id))
                conn.commit()
        finally:
            conn.close()
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
