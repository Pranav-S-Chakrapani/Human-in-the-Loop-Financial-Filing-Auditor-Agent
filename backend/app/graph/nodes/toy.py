from typing import Any, Dict
from langgraph.types import interrupt
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus

async def toy_step_a(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    if is_node_completed(run_id, "step_a"):
        await event_bus.emit("node_skipped", {"node": "step_a", "reason": "already_done"}, run_id=run_id)
        return {}

    record_node_start(run_id, "step_a")
    await event_bus.emit("node_started", {"node": "step_a"}, run_id=run_id)

    step_a_count = state.get("step_a_count", 0) + 1

    record_node_finish(run_id, "step_a", "done")
    await event_bus.emit("node_completed", {"node": "step_a", "summary": f"count={step_a_count}"}, run_id=run_id)
    return {"step_a_count": step_a_count}

async def toy_human_review(state: Dict[str, Any]) -> Dict[str, Any]:
    # RULES.md #6: interrupt() is the FIRST statement of its node with nothing else before it.
    decision = interrupt({
        "type": "toy_review",
        "review_id": state.get("current_review_id", "rv_toy_1"),
        "question": "Approve toy run?",
        "step_a_count": state.get("step_a_count", 0)
    })

    run_id = state.get("run_id", "")
    record_node_start(run_id, "human_review")
    record_node_finish(run_id, "human_review", "done")

    return {
        "human_decision": decision,
        "reviewed": True
    }

async def toy_step_b(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    if is_node_completed(run_id, "step_b"):
        await event_bus.emit("node_skipped", {"node": "step_b", "reason": "already_done"}, run_id=run_id)
        return {}

    record_node_start(run_id, "step_b")
    await event_bus.emit("node_started", {"node": "step_b"}, run_id=run_id)

    step_b_count = state.get("step_b_count", 0) + 1

    record_node_finish(run_id, "step_b", "done")
    await event_bus.emit("node_completed", {"node": "step_b", "summary": f"count={step_b_count}"}, run_id=run_id)
    return {"step_b_count": step_b_count}
