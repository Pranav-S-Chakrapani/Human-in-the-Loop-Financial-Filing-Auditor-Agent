import hashlib
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.app.db import get_connection

def canonical_json(data: Dict[str, Any]) -> str:
    """Deterministic JSON string per RULES #15."""
    return json.dumps(data, sort_keys=True, separators=(',', ':'))

def compute_row_hash(prev_hash: Optional[str], row_data: Dict[str, Any]) -> str:
    """row_hash = sha256(prev_hash + canonical_json(row_without_hash_fields))"""
    prev = prev_hash or ""
    canon = canonical_json(row_data)
    to_hash = (prev + canon).encode("utf-8")
    return hashlib.sha256(to_hash).hexdigest()

def append_audit_entry(
    review_id: str,
    run_id: str,
    company: str,
    metric: str,
    period: str,
    original_value: Optional[float],
    corrected_value: Optional[float],
    decision: str,
    reviewer: str,
    note: str,
    reasons: Any,
    confidence: float,
    db_path: Optional[Path] = None
) -> Tuple[int, str]:
    """
    Append an entry to audit_log inside BEGIN IMMEDIATE with hash chaining.
    Returns (seq, row_hash).
    """
    reasons_str = json.dumps(reasons) if isinstance(reasons, (list, dict)) else str(reasons)
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE;")

        # Get latest head hash
        cursor.execute("SELECT seq, row_hash FROM audit_log ORDER BY seq DESC LIMIT 1;")
        last_row = cursor.fetchone()
        prev_hash = last_row["row_hash"] if last_row else ""

        row_payload = {
            "review_id": review_id,
            "run_id": run_id,
            "company": company,
            "metric": metric,
            "period": period,
            "original_value": original_value,
            "corrected_value": corrected_value,
            "decision": decision,
            "reviewer": reviewer,
            "note": note,
            "reasons": reasons_str,
            "confidence": confidence,
            "ts": now_iso
        }
        row_hash = compute_row_hash(prev_hash, row_payload)

        cursor.execute(
            """
            INSERT INTO audit_log (
                review_id, run_id, company, metric, period,
                original_value, corrected_value, decision, reviewer,
                note, reasons, confidence, ts, prev_hash, row_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                review_id, run_id, company, metric, period,
                original_value, corrected_value, decision, reviewer,
                note, reasons_str, confidence, now_iso, prev_hash, row_hash
            )
        )
        seq = cursor.lastrowid
        conn.commit()
        return seq, row_hash
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def verify_audit_chain(db_path: Optional[Path] = None) -> Dict[str, Any]:
    """Verify entire audit_log hash chain."""
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM audit_log ORDER BY seq ASC;")
        rows = cursor.fetchall()

        if not rows:
            return {"ok": True, "rows": 0, "head_hash": None, "first_bad_seq": None}

        current_prev_hash = ""
        for r in rows:
            row_payload = {
                "review_id": r["review_id"],
                "run_id": r["run_id"],
                "company": r["company"],
                "metric": r["metric"],
                "period": r["period"],
                "original_value": r["original_value"],
                "corrected_value": r["corrected_value"],
                "decision": r["decision"],
                "reviewer": r["reviewer"],
                "note": r["note"],
                "reasons": r["reasons"],
                "confidence": r["confidence"],
                "ts": r["ts"]
            }
            # verify prev_hash matches
            if (r["prev_hash"] or "") != current_prev_hash:
                return {
                    "ok": False,
                    "rows": len(rows),
                    "head_hash": None,
                    "first_bad_seq": r["seq"]
                }

            expected_hash = compute_row_hash(current_prev_hash, row_payload)
            if expected_hash != r["row_hash"]:
                return {
                    "ok": False,
                    "rows": len(rows),
                    "head_hash": None,
                    "first_bad_seq": r["seq"]
                }
            current_prev_hash = r["row_hash"]

        return {
            "ok": True,
            "rows": len(rows),
            "head_hash": current_prev_hash,
            "first_bad_seq": None
        }
    finally:
        conn.close()
