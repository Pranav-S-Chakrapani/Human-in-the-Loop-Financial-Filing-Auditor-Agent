import json
import sqlite3
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from backend.app.db import get_connection
from backend.app.audit import verify_audit_chain

router = APIRouter(tags=["audit"])

@router.get("/audit")
def list_audit_entries(
    limit: int = Query(50, ge=1, le=500),
    after_seq: Optional[int] = Query(None)
) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        if after_seq is not None:
            cur.execute(
                "SELECT * FROM audit_log WHERE seq > ? ORDER BY seq ASC LIMIT ?",
                (after_seq, limit)
            )
        else:
            cur.execute(
                "SELECT * FROM audit_log ORDER BY seq ASC LIMIT ?",
                (limit,)
            )
        rows = cur.fetchall()
        result = []
        for r in rows:
            reasons_val = r["reasons"]
            try:
                reasons_parsed = json.loads(reasons_val)
            except Exception:
                reasons_parsed = [reasons_val] if reasons_val else []

            result.append({
                "seq": r["seq"],
                "review_id": r["review_id"],
                "run_id": r["run_id"],
                "company": r["company"],
                "metric": r["metric"],
                "period": r["period"],
                "original_value": r["original_value"],
                "corrected_value": r["corrected_value"],
                "decision": r["decision"],
                "reviewer": r["reviewer"],
                "note": r["note"] or "",
                "reasons": reasons_parsed,
                "confidence": r["confidence"],
                "ts": r["ts"],
                "prev_hash": r["prev_hash"],
                "row_hash": r["row_hash"]
            })
        return result
    finally:
        conn.close()

@router.get("/audit/verify")
def verify_audit():
    return verify_audit_chain()

@router.post("/admin/tamper")
def tamper_audit():
    """
    CONTRACT.md /admin/tamper:
    Tries UPDATE and DELETE on audit_log to prove triggers block tampering.
    """
    update_blocked = False
    delete_blocked = False
    errors = []

    # Ensure at least one row exists to tamper with
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT seq FROM audit_log LIMIT 1;")
        row = cur.fetchone()
        if not row:
            # Create a test entry to tamper with
            from backend.app.audit import append_audit_entry
            test_seq, _ = append_audit_entry(
                review_id="rv_tamper_probe",
                run_id="r_tamper",
                company="Tamper Corp",
                metric="test_metric",
                period="FY2026",
                original_value=1.0,
                corrected_value=None,
                decision="approve",
                reviewer="probe",
                note="",
                reasons=[],
                confidence=0.5
            )
        else:
            test_seq = row["seq"]

        # Try UPDATE
        try:
            conn.execute("UPDATE audit_log SET note = 'tampered' WHERE seq = ?", (test_seq,))
        except (sqlite3.OperationalError, sqlite3.IntegrityError) as e:
            update_blocked = True
            errors.append(str(e))

        # Try DELETE
        try:
            conn.execute("DELETE FROM audit_log WHERE seq = ?", (test_seq,))
        except (sqlite3.OperationalError, sqlite3.IntegrityError) as e:
            delete_blocked = True
            errors.append(str(e))

    finally:
        conn.close()

    return {
        "update_blocked": update_blocked,
        "delete_blocked": delete_blocked,
        "errors": errors
    }
