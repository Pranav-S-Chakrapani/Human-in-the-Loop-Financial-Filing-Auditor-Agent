import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from backend.app.config import get_config
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.db import get_connection

async def triage_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    if is_node_completed(run_id, "triage"):
        await event_bus.emit("node_skipped", {"node": "triage", "reason": "already_done"}, run_id=run_id)
        return {}

    record_node_start(run_id, "triage")
    await event_bus.emit("node_started", {"node": "triage"}, run_id=run_id)

    cfg = get_config()
    scored_metrics = state.get("scored_metrics", {})
    validations = state.get("validations", [])
    now_iso = datetime.now(timezone.utc).isoformat()

    # Index validations by metric and check_type
    val_map: Dict[str, List[Dict[str, Any]]] = {}
    for v in validations:
        m = v.get("metric", "")
        val_map.setdefault(m, []).append(v)

    triaged_metrics: Dict[str, Any] = {}
    reviews_to_create: List[Dict[str, Any]] = []

    for metric_name, m_data in scored_metrics.items():
        conf = m_data.get("confidence", 0.0)
        curr_val = m_data.get("value_dollars")
        method = m_data.get("method", "agree")
        metric_vals = val_map.get(metric_name, [])

        reasons: List[Dict[str, str]] = []

        # Check: NOT_FOUND / not_reported
        if curr_val is None:
            if metric_name == "gross_profit":
                m_data["decision_status"] = "not_reported"
                m_data["final_value"] = None
            else:
                reasons.append({"code": "NOT_FOUND", "text": f"Metric {metric_name} not found in visual tables"})
        else:
            # Check: EXTRACTOR_DISAGREE
            if method == "disagree":
                reasons.append({"code": "EXTRACTOR_DISAGREE", "text": "Rules and LLM extractors returned conflicting numbers"})

            # Check: LOW_CONF
            if conf < cfg.confidence_threshold:
                reasons.append({"code": "LOW_CONF", "text": f"Confidence {conf:.2f} below threshold {cfg.confidence_threshold:.2f}"})

            # Check: validation failures
            for v in metric_vals:
                c_type = v.get("check_type")
                status = v.get("status")
                if status == "failed":
                    if c_type == "equation":
                        reasons.append({"code": "EQ_FAIL", "text": "Assets ≠ Liabilities + Equity"})
                    elif c_type == "yoy":
                        pct = v.get("detail", {}).get("pct_change", 0.0)
                        reasons.append({"code": "YOY_ANOMALY", "text": f"YoY variance {pct:+.1f}% exceeds threshold {cfg.yoy_threshold_pct}%"})
                    elif c_type == "cross_statement":
                        reasons.append({"code": "CROSS_STATEMENT", "text": "Net income does not match cash flow starting value"})
                    elif c_type == "segment":
                        reasons.append({"code": "SEGMENT_MISMATCH", "text": "Segment sum does not match total revenue"})

        # Prior year values are NEVER escalated (RULES / SPEC §10)
        if reasons and m_data.get("decision_status") != "not_reported":
            m_data["decision_status"] = "pending_review"
            m_data["final_value"] = None

            review_id = f"rv_{run_id}_{metric_name}"
            reviews_to_create.append({
                "review_id": review_id,
                "run_id": run_id,
                "metric_id": f"m_{run_id}_{metric_name}",
                "metric": metric_name,
                "round": 1,
                "status": "pending",
                "reasons": reasons,
                "confidence": conf,
                "created_at": now_iso
            })
        elif m_data.get("decision_status") != "not_reported":
            m_data["decision_status"] = "auto_approved"
            m_data["final_value"] = curr_val

        triaged_metrics[metric_name] = m_data

    # Commit all DB records in one clean block
    conn = get_connection()
    try:
        cur = conn.cursor()

        # Insert reviews
        for r in reviews_to_create:
            cur.execute(
                """
                INSERT OR REPLACE INTO reviews (review_id, run_id, metric_id, round, status, reasons, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (r["review_id"], run_id, r["metric_id"], 1, "pending", json.dumps(r["reasons"]), now_iso)
            )

        # Insert metrics
        for metric_name, m_data in triaged_metrics.items():
            metric_id = f"m_{run_id}_{metric_name}"
            cur.execute(
                """
                INSERT OR REPLACE INTO metrics (
                    metric_id, run_id, metric, period_label, period_end, is_current,
                    unit_label, scale, value_a, value_b, value_dollars, snippet_text,
                    snippet_html, source_ref, confidence, confidence_breakdown,
                    method, decision_status, final_value, fault_injected, ground_truth
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    metric_id, run_id, metric_name, "FY", "2026", 1,
                    "in millions" if m_data.get("scale", 1) >= 1000000 else "USD",
                    m_data.get("scale", 1),
                    m_data.get("value_a"), m_data.get("value_b"), m_data.get("value_dollars"),
                    m_data.get("snippet_text", ""), m_data.get("snippet_html", ""),
                    json.dumps(m_data.get("source_ref", {})),
                    m_data.get("confidence", 0.0), json.dumps(m_data.get("confidence_breakdown", {})),
                    m_data.get("method", "agree"), m_data.get("decision_status"), m_data.get("final_value"),
                    1 if m_data.get("fault_injected") else 0,
                    None
                )
            )

        # Insert validations
        for v in validations:
            v_id = v.get("validation_id", f"v_{uuid.uuid4().hex[:6]}")
            cur.execute(
                """
                INSERT OR REPLACE INTO validations (
                    validation_id, run_id, metric_id, check_type, status, phase, detail, explanation
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    v_id, run_id, f"m_{run_id}_{v.get('metric', '')}", v.get("check_type"),
                    v.get("status"), v.get("phase"), json.dumps(v.get("detail", {})),
                    v.get("explanation")
                )
            )

        conn.commit()
    finally:
        conn.close()

    # Emit review_enqueued events AFTER closing the connection
    for r in reviews_to_create:
        await event_bus.emit(
            "review_enqueued",
            {"review_id": r["review_id"], "metric": r["metric"], "reasons": r["reasons"]},
            run_id=run_id
        )

    record_node_finish(run_id, "triage", "done")
    auto_count = sum(1 for m in triaged_metrics.values() if m.get("decision_status") == "auto_approved")
    pend_count = len(reviews_to_create)
    await event_bus.emit(
        "node_completed",
        {"node": "triage", "summary": f"Triage complete: {auto_count} auto-approved, {pend_count} pending review"},
        run_id=run_id
    )

    return {
        "scored_metrics": triaged_metrics,
        "pending_reviews": reviews_to_create
    }
