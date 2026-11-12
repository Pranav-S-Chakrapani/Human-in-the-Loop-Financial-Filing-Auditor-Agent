import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from langgraph.types import Command
from backend.app.db import get_connection
from backend.app.events import event_bus

async def reconcile_runs(app_state: Any, db_path: Optional[Path] = None) -> List[str]:
    """
    RULES.md #10:
    Startup reconciler resumes paused runs whose head review is already decided,
    and resumes running runs with ainvoke(None, config).
    Emits system_recovered event.
    """
    resumed_runs: List[str] = []
    replayed_decisions: List[str] = []

    conn = get_connection(db_path)
    try:
        cur = conn.cursor()

        # 1. Check paused runs with decided reviews
        cur.execute(
            """
            SELECT r.run_id, r.current_node, rev.review_id, rev.status, a.decision, a.corrected_value, a.note
            FROM runs r
            JOIN reviews rev ON r.run_id = rev.run_id
            JOIN audit_log a ON rev.review_id = a.review_id
            WHERE r.status = 'paused' AND rev.status != 'pending'
            """
        )
        paused_decided = cur.fetchall()

        for row in paused_decided:
            run_id = row["run_id"]
            review_id = row["review_id"]
            decision_payload = {
                "decision": row["decision"],
                "corrected_value": row["corrected_value"],
                "note": row["note"]
            }

            config = {"configurable": {"thread_id": run_id}}
            graph = app_state.toy_graph if "toy" in run_id else app_state.pipeline_graph

            try:
                # Resume with stored decision
                await graph.ainvoke(Command(resume=decision_payload), config)
                cur.execute("UPDATE runs SET status = 'running', updated_at = ? WHERE run_id = ?",
                            (datetime.now(timezone.utc).isoformat(), run_id))
                conn.commit()
                resumed_runs.append(run_id)
                replayed_decisions.append(review_id)
            except Exception as e:
                print(f"Reconciler error on paused run {run_id}: {e}")

        # 2. Check running runs that crashed mid-execution
        cur.execute("SELECT run_id, current_node FROM runs WHERE status = 'running'")
        running_runs = cur.fetchall()

        for row in running_runs:
            run_id = row["run_id"]
            if run_id in resumed_runs:
                continue

            config = {"configurable": {"thread_id": run_id}}
            graph = app_state.toy_graph if "toy" in run_id else app_state.pipeline_graph

            try:
                # Resume crashed run from checkpointer without payload
                await graph.ainvoke(None, config)
                resumed_runs.append(run_id)
            except Exception as e:
                print(f"Reconciler error on running run {run_id}: {e}")

    finally:
        conn.close()

    if resumed_runs or replayed_decisions:
        await event_bus.emit(
            "system_recovered",
            {"resumed_runs": resumed_runs, "replayed_decisions": replayed_decisions}
        )

    return resumed_runs
