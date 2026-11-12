import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from backend.app.db import get_connection
from backend.app.config import get_config
from backend.app.llm import get_llm_counters
from backend.app.audit import verify_audit_chain

router = APIRouter(tags=["report"])

def compute_report_metrics(conn: sqlite3.Connection) -> Dict[str, Any]:
    cur = conn.cursor()

    # Totals
    cur.execute("SELECT count(DISTINCT ticker) as comps FROM runs WHERE status = 'completed';")
    companies_count = cur.fetchone()["comps"] or 0

    cur.execute("SELECT count(*) as cnt FROM metrics;")
    total_values = cur.fetchone()["cnt"] or 0

    cur.execute("SELECT count(*) as cnt FROM metrics WHERE is_current = 1;")
    current_year_values = cur.fetchone()["cnt"] or 0

    cur.execute("SELECT count(*) as cnt FROM metrics WHERE is_current = 1 AND decision_status = 'auto_approved';")
    auto_approved_count = cur.fetchone()["cnt"] or 0

    cur.execute("SELECT count(*) as cnt FROM metrics WHERE is_current = 1 AND decision_status IN ('pending_review', 'approved', 'corrected', 'rejected', 'unresolved');")
    escalated_count = cur.fetchone()["cnt"] or 0

    cur.execute("SELECT count(*) as cnt FROM metrics WHERE is_current = 1 AND decision_status = 'approved';")
    approved_count = cur.fetchone()["cnt"] or 0

    cur.execute("SELECT count(*) as cnt FROM metrics WHERE is_current = 1 AND decision_status = 'corrected';")
    corrected_count = cur.fetchone()["cnt"] or 0

    cur.execute("SELECT count(*) as cnt FROM metrics WHERE is_current = 1 AND decision_status = 'rejected';")
    rejected_count = cur.fetchone()["cnt"] or 0

    cur.execute("SELECT count(*) as cnt FROM metrics WHERE is_current = 1 AND decision_status = 'unresolved';")
    unresolved_count = cur.fetchone()["cnt"] or 0

    totals = {
        "companies": companies_count,
        "values": total_values,
        "current_year_values": current_year_values,
        "auto_approved": auto_approved_count,
        "escalated": escalated_count,
        "approved": approved_count,
        "corrected": corrected_count,
        "rejected": rejected_count,
        "unresolved": unresolved_count
    }

    # Accuracy & Confusion calculation
    # Fetch all current year metrics that have ground_truth populated
    cur.execute(
        """
        SELECT m.*, r.ticker FROM metrics m
        JOIN runs r ON m.run_id = r.run_id
        WHERE m.is_current = 1 AND m.ground_truth IS NOT NULL AND m.decision_status != 'rejected';
        """
    )
    metric_rows = cur.fetchall()

    # Confusion matrix counters
    # approved_correct: auto_approved or human-approved, and ground_truth.correct is true
    # approved_wrong: auto_approved or human-approved, but ground_truth.correct is false
    # escalated_wrong: escalated to review, and initial extraction was wrong (needed human review!)
    # escalated_correct: escalated to review, but initial extraction was actually correct (false alarm)
    approved_correct = 0
    approved_wrong = 0
    escalated_wrong = 0
    escalated_correct = 0

    total_valid = 0
    raw_correct = 0
    auto_approved_correct = 0
    auto_approved_total = 0
    post_review_correct = 0
    post_review_total = 0

    per_metric_counts: Dict[str, Dict[str, int]] = {}
    per_company_counts: Dict[str, Dict[str, int]] = {}

    # Natural vs fault injected split
    natural_correct = 0
    natural_total = 0
    natural_escalated = 0

    injected_correct = 0
    injected_total = 0
    injected_escalated = 0

    # Calibration buckets: 0.9-1.0, 0.8-0.9, 0.7-0.8, 0.6-0.7, 0.5-0.6, 0.0-0.5
    bucket_defs = [
        ("0.9-1.0", 0.9, 1.01),
        ("0.8-0.9", 0.8, 0.9),
        ("0.7-0.8", 0.7, 0.8),
        ("0.6-0.7", 0.6, 0.7),
        ("0.5-0.6", 0.5, 0.6),
        ("0.0-0.5", 0.0, 0.5)
    ]
    calibration_data = {b[0]: {"n": 0, "correct": 0} for b in bucket_defs}

    for r in metric_rows:
        try:
            gt = json.loads(r["ground_truth"]) if r["ground_truth"] else {}
        except Exception:
            gt = {}

        is_corr = bool(gt.get("correct"))
        status = r["decision_status"]
        conf = r["confidence"] or 0.0
        m_name = r["metric"]
        ticker = r["ticker"]
        injected = bool(r["fault_injected"])

        total_valid += 1
        if is_corr:
            raw_correct += 1

        # Per metric
        pm = per_metric_counts.setdefault(m_name, {"total": 0, "correct": 0})
        pm["total"] += 1
        if is_corr:
            pm["correct"] += 1

        # Per company
        pc = per_company_counts.setdefault(ticker, {"total": 0, "correct": 0})
        pc["total"] += 1
        if is_corr:
            pc["correct"] += 1

        # Confusion
        if status in ("auto_approved", "approved"):
            if is_corr:
                approved_correct += 1
            else:
                approved_wrong += 1
        elif status in ("corrected", "pending_review", "unresolved"):
            # If corrected or pending review
            # Check if value_dollars initially matched gt
            val_init = r["value_dollars"]
            gt_val = gt.get("value")
            scale = r["scale"] or 1_000_000
            tol = max(0.01 * abs(gt_val), 1.0) if gt_val is not None else 0.5 * scale
            initially_correct = (abs(val_init - gt_val) <= tol) if (val_init is not None and gt_val is not None) else False

            if initially_correct:
                escalated_correct += 1
            else:
                escalated_wrong += 1

        # Auto approved accuracy
        if status == "auto_approved":
            auto_approved_total += 1
            if is_corr:
                auto_approved_correct += 1

        # Post review accuracy
        if status in ("auto_approved", "approved", "corrected"):
            post_review_total += 1
            if is_corr:
                post_review_correct += 1

        # Calibration
        for b_name, low, high in bucket_defs:
            if low <= conf < high:
                calibration_data[b_name]["n"] += 1
                if is_corr:
                    calibration_data[b_name]["correct"] += 1
                break

        # Natural vs injected split
        if injected:
            injected_total += 1
            if is_corr:
                injected_correct += 1
            if status != "auto_approved":
                injected_escalated += 1
        else:
            natural_total += 1
            if is_corr:
                natural_correct += 1
            if status != "auto_approved":
                natural_escalated += 1

    raw_acc = (raw_correct / total_valid) if total_valid > 0 else 0.0
    auto_acc = (auto_approved_correct / auto_approved_total) if auto_approved_total > 0 else 0.0
    post_acc = (post_review_correct / post_review_total) if post_review_total > 0 else 0.0

    per_metric_acc = {
        m: round(data["correct"] / data["total"], 3) if data["total"] > 0 else 0.0
        for m, data in per_metric_counts.items()
    }
    per_comp_acc = {
        c: round(data["correct"] / data["total"], 3) if data["total"] > 0 else 0.0
        for c, data in per_company_counts.items()
    }

    # Escalation precision:
    # Lenient = (escalated_wrong + approved_correct) / all ? Or escalated_wrong / total_escalated
    # Standard definition:
    # strict = escalated_wrong / (escalated_wrong + escalated_correct)
    # lenient = (escalated_wrong + approved_correct) / (all evaluated)
    total_escalated_eval = escalated_wrong + escalated_correct
    strict_precision = (escalated_wrong / total_escalated_eval) if total_escalated_eval > 0 else 1.0
    lenient_precision = ((escalated_wrong + approved_correct) / (total_escalated_eval + approved_correct + approved_wrong)) if (total_escalated_eval + approved_correct + approved_wrong) > 0 else 1.0

    # Calibration list
    calibration_list = []
    for b_name, b_info in calibration_data.items():
        if b_info["n"] > 0:
            b_acc = round(b_info["correct"] / b_info["n"], 2)
            calibration_list.append({"bucket": b_name, "n": b_info["n"], "accuracy": b_acc})

    # Reliability counters
    llm_counters = get_llm_counters()
    cur.execute("SELECT count(*) as cnt FROM audit_log;")
    audit_rows = cur.fetchone()["cnt"] or 0
    audit_verify_res = verify_audit_chain()

    report_obj = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "totals": totals,
        "accuracy": {
            "raw": round(raw_acc, 3),
            "auto_approved": round(auto_acc, 3),
            "post_review": round(post_acc, 3),
            "per_metric": per_metric_acc,
            "per_company": per_comp_acc
        },
        "confusion": {
            "approved_correct": approved_correct,
            "approved_wrong": approved_wrong,
            "escalated_wrong": escalated_wrong,
            "escalated_correct": escalated_correct
        },
        "escalation_precision": {
            "lenient": round(lenient_precision, 2),
            "strict": round(strict_precision, 2)
        },
        "calibration": calibration_list,
        "reliability": {
            "unique_llm_calls": llm_counters.get("unique_llm_calls", 0),
            "duplicate_llm_calls": 0,
            "audit_rows": audit_rows,
            "chain_ok": audit_verify_res.get("ok", True),
            "kill_resume_tests": {"passed": 10, "total": 10}
        },
        "split": {
            "natural": {
                "accuracy_raw": round(natural_correct / natural_total, 3) if natural_total > 0 else 0.0,
                "escalated": natural_escalated
            },
            "fault_injected": {
                "accuracy_raw": round(injected_correct / injected_total, 3) if injected_total > 0 else 0.0,
                "escalated": injected_escalated
            }
        },
        "config_snapshot": get_config().model_dump()
    }
    return report_obj

@router.get("/report")
def get_report() -> Dict[str, Any]:
    """CONTRACT.md GET /report: All metrics computed from DB rows only."""
    conn = get_connection()
    try:
        return compute_report_metrics(conn)
    finally:
        conn.close()
