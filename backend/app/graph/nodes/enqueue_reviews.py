import json
from typing import Any, Dict, List
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.db import get_connection

async def enqueue_reviews_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    record_node_start(run_id, "enqueue_reviews")
    await event_bus.emit("node_started", {"node": "enqueue_reviews"}, run_id=run_id)

    # Fetch pending reviews for this run from database
    conn = get_connection()
    pending_queue: List[str] = []
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT review_id FROM reviews WHERE run_id = ? AND status = 'pending' ORDER BY rowid ASC",
            (run_id,)
        )
        rows = cur.fetchall()
        pending_queue = [r["review_id"] for r in rows]
    finally:
        conn.close()

    head_review_id = pending_queue[0] if pending_queue else None

    record_node_finish(run_id, "enqueue_reviews", "done")
    await event_bus.emit(
        "node_completed",
        {"node": "enqueue_reviews", "summary": f"Enqueued {len(pending_queue)} reviews, head={head_review_id}"},
        run_id=run_id
    )

    return {
        "review_queue": pending_queue,
        "current_review_id": head_review_id
    }
