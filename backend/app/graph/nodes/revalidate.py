from typing import Any, Dict
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.graph.nodes.validate import validate_node

async def revalidate_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    record_node_start(run_id, "revalidate")
    await event_bus.emit("node_started", {"node": "revalidate"}, run_id=run_id)

    # Re-run validation logic with updated metric dollars
    res = await validate_node(state)

    record_node_finish(run_id, "revalidate", "done")
    await event_bus.emit("node_completed", {"node": "revalidate", "summary": "Revalidation completed"}, run_id=run_id)

    return res
