import json
from typing import Any, Dict, List, Optional
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.db import get_connection

async def apply_decisions_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    record_node_start(run_id, "apply_decisions")
    await event_bus.emit("node_started", {"node": "apply_decisions"}, run_id=run_id)

    decision_data = state.get("human_decision") or {}
    review_id = state.get("reviewed_id") or state.get("current_review_id") or ""

    decision = decision_data.get("decision")
    corrected_val = decision_data.get("corrected_value")
    note = decision_data.get("note", "")

    needs_revalidate = False
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM reviews WHERE review_id = ?", (review_id,))
        rev = cur.fetchone()
        metric_id = rev["metric_id"] if rev else ""

        if rev and decision:
            # SPEC §10 semantics
            if decision == "approve":
                # Final value is current value_dollars
                cur.execute(
                    "UPDATE metrics SET decision_status = 'approved', final_value = value_dollars WHERE metric_id = ?",
                    (metric_id,)
                )
            elif decision == "correct":
                # Value is corrected, triggers revalidate
                cur.execute(
                    "UPDATE metrics SET decision_status = 'corrected', final_value = ?, value_dollars = ? WHERE metric_id = ?",
                    (corrected_val, corrected_val, metric_id)
                )
                needs_revalidate = True
            elif decision == "reject":
                # Rejected -> final value is null, status is rejected
                cur.execute(
                    "UPDATE metrics SET decision_status = 'rejected', final_value = NULL WHERE metric_id = ?",
                    (metric_id,)
                )

        # Mark review as decided if not already
        if decision:
            cur.execute("UPDATE reviews SET status = ? WHERE review_id = ?", (decision, review_id))

        # Check remaining pending reviews
        cur.execute("SELECT review_id FROM reviews WHERE run_id = ? AND status = 'pending' ORDER BY rowid ASC", (run_id,))
        rows = cur.fetchall()
        remaining_queue = [r["review_id"] for r in rows]

        conn.commit()
    finally:
        conn.close()

    next_review_id = remaining_queue[0] if remaining_queue else None

    record_node_finish(run_id, "apply_decisions", "done")
    await event_bus.emit(
        "node_completed",
        {"node": "apply_decisions", "summary": f"Applied {decision} for {review_id}, remaining={len(remaining_queue)}"},
        run_id=run_id
    )

    return {
        "review_queue": remaining_queue,
        "current_review_id": next_review_id,
        "needs_revalidate": needs_revalidate
    }
