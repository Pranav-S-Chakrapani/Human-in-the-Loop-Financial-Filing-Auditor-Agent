import json
from typing import Any, Dict
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.db import get_connection
# RULES.md #1: groundtruth.py is imported ONLY in verify and report nodes
from backend.app.groundtruth import load_ground_truth

async def ground_truth_verify_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    ticker = state.get("ticker", "")

    record_node_start(run_id, "ground_truth_verify")
    await event_bus.emit("node_started", {"node": "ground_truth_verify"}, run_id=run_id)

    gt_data = load_ground_truth(ticker)
    conn = get_connection()
    verified_metrics = {}

    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM metrics WHERE run_id = ?", (run_id,))
        rows = cur.fetchall()

        for r in rows:
            m_name = r["metric"]
            final_val = r["final_value"]
            scale = r["scale"] or 1_000_000
            tolerance = 0.5 * scale  # SPEC §10: tolerance 0.5*scale

            gt_item = gt_data.get(m_name, {})
            gt_curr = gt_item.get("current", {})
            gt_val = gt_curr.get("value")

            if gt_val is not None and final_val is not None:
                delta = abs(final_val - gt_val)
                is_correct = delta <= tolerance
            elif gt_val is None and r["decision_status"] == "not_reported":
                is_correct = True
            else:
                is_correct = False

            gt_record = {
                "concept": gt_item.get("concept"),
                "value": gt_val,
                "correct": is_correct
            }
            verified_metrics[m_name] = gt_record

            cur.execute(
                "UPDATE metrics SET ground_truth = ? WHERE metric_id = ?",
                (json.dumps(gt_record), r["metric_id"])
            )

        conn.commit()
    finally:
        conn.close()

    record_node_finish(run_id, "ground_truth_verify", "done")
    correct_count = sum(1 for v in verified_metrics.values() if v.get("correct"))
    await event_bus.emit(
        "node_completed",
        {"node": "ground_truth_verify", "summary": f"Verified {correct_count}/{len(verified_metrics)} against SEC XBRL ground truth"},
        run_id=run_id
    )

    return {"ground_truth_results": verified_metrics}
