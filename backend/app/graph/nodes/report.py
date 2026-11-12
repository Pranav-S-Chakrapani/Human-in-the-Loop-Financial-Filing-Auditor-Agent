import json
from typing import Any, Dict
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.db import get_connection

async def report_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    record_node_start(run_id, "report")
    await event_bus.emit("node_started", {"node": "report"}, run_id=run_id)

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT count(*) as total, sum(CASE WHEN ground_truth LIKE '%\"correct\": true%' THEN 1 ELSE 0 END) as correct FROM metrics WHERE run_id = ?", (run_id,))
        stats = cur.fetchone()
        tot = stats["total"] or 1
        corr = stats["correct"] or 0
        accuracy = corr / tot

        cur.execute("SELECT count(*) as esc FROM reviews WHERE run_id = ?", (run_id,))
        esc = cur.fetchone()["esc"] or 0
    finally:
        conn.close()

    record_node_finish(run_id, "report", "done")
    await event_bus.emit(
        "run_completed",
        {"accuracy_raw": accuracy, "escalated": esc},
        run_id=run_id
    )

    return {
        "final_accuracy": accuracy,
        "escalated_count": esc
    }
