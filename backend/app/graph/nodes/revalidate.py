import json
from datetime import datetime, timezone
from typing import Any, Dict, List
from backend.app.config import get_config
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.db import get_connection
from backend.app.graph.nodes.validate import run_validation_checks

async def revalidate_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    record_node_start(run_id, "revalidate")
    await event_bus.emit("node_started", {"node": "revalidate"}, run_id=run_id)

    cfg = get_config()
    scored = state.get("scored_metrics", {})
    located = state.get("located_statements", {})

    # Sync scored metrics with updated values in database (from apply_decisions)
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM metrics WHERE run_id = ?", (run_id,))
        for m in cur.fetchall():
            m_name = m["metric"]
            if m_name in scored:
                scored[m_name]["value_dollars"] = m["value_dollars"]
                scored[m_name]["decision_status"] = m["decision_status"]
    finally:
        conn.close()

    # Re-run validation checks under phase="revalidate"
    new_validations = await run_validation_checks(scored, located, run_id, phase="revalidate")

    # Save validations into database
    conn = get_connection()
    try:
        cur = conn.cursor()
        for v in new_validations:
            cur.execute(
                """
                INSERT INTO validations (validation_id, run_id, metric_id, check_type, status, phase, detail, explanation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(validation_id) DO UPDATE SET
                    status = excluded.status,
                    detail = excluded.detail,
                    explanation = excluded.explanation
                """,
                (
                    v["validation_id"],
                    run_id,
                    f"m_{run_id}_{v['metric']}",
                    v["check_type"],
                    v["status"],
                    v["phase"],
                    json.dumps(v.get("detail", {})),
                    v.get("explanation")
                )
            )

        # Check reviewed metric to see if validation failed
        rev_id = state.get("reviewed_id") or state.get("current_review_id") or ""
        cur.execute("SELECT * FROM reviews WHERE review_id = ?", (rev_id,))
        rev = cur.fetchone()

        if rev:
            metric_id = rev["metric_id"]
            metric_name = metric_id.replace(f"m_{run_id}_", "")
            curr_round = rev["round"] or 1

            failed_for_metric = [v for v in new_validations if v["metric"] == metric_name and v["status"] == "failed"]
            if failed_for_metric:
                # Validation failed after correction
                if curr_round < cfg.max_review_rounds:
                    # Exactly one more review round
                    next_round = curr_round + 1
                    next_rev_id = f"rv_{run_id}_{metric_name}_r{next_round}"
                    reasons = [{"code": "REVALIDATION_FAIL", "text": f"Corrected value failed {failed_for_metric[0]['check_type']} validation"}]
                    cur.execute(
                        """
                        INSERT INTO reviews (review_id, run_id, metric_id, round, status, reasons, created_at)
                        VALUES (?, ?, ?, ?, 'pending', ?, ?)
                        ON CONFLICT(run_id, metric_id, round) DO NOTHING
                        """,
                        (next_rev_id, run_id, metric_id, next_round, json.dumps(reasons), datetime.now(timezone.utc).isoformat())
                    )
                    # Add to review queue
                    queue = state.get("review_queue") or []
                    if next_rev_id not in queue:
                        queue.append(next_rev_id)
                    state["review_queue"] = queue
                    state["current_review_id"] = queue[0]
                else:
                    # Exceeded max_review_rounds -> mark unresolved (RULES #13)
                    cur.execute(
                        "UPDATE metrics SET decision_status = 'unresolved', final_value = NULL WHERE metric_id = ?",
                        (metric_id,)
                    )
                    scored[metric_name]["decision_status"] = "unresolved"
                    scored[metric_name]["final_value"] = None

        conn.commit()
    finally:
        conn.close()

    record_node_finish(run_id, "revalidate", "done")
    await event_bus.emit("node_completed", {"node": "revalidate", "summary": f"Completed revalidation with {len(new_validations)} checks"}, run_id=run_id)

    return {
        "scored_metrics": scored,
        "validations": new_validations,
        "review_queue": state.get("review_queue", []),
        "current_review_id": state.get("current_review_id"),
        "needs_revalidate": False
    }
