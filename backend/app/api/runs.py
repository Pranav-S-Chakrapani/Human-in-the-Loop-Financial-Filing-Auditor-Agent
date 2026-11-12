import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from backend.app.db import get_connection
from backend.app.events import event_bus
from backend.app.models import RunCreateRequest, RunCreateResponse, RunCreatedItem

router = APIRouter(tags=["runs"])

@router.get("/runs")
def list_runs() -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM runs ORDER BY created_at DESC;")
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                "run_id": r["run_id"],
                "company": r["company"],
                "ticker": r["ticker"],
                "fiscal_year": r["fiscal_year"] or 2026,
                "status": r["status"],
                "current_node": r["current_node"],
                "counts": {"metrics": 0, "auto_approved": 0, "pending": 0, "decided": 0},
                "created_at": r["created_at"],
                "updated_at": r["updated_at"]
            })
        return result
    finally:
        conn.close()

async def execute_run_graph(run_id: str, is_toy: bool, app_state: Any, initial_state: Dict[str, Any]):
    graph = app_state.toy_graph if is_toy else app_state.pipeline_graph
    config = {"configurable": {"thread_id": run_id}}

    try:
        res = await graph.ainvoke(initial_state, config)
        state = await graph.aget_state(config)

        conn = get_connection()
        try:
            cur = conn.cursor()
            now_iso = datetime.now(timezone.utc).isoformat()
            if state.next:
                # Interrupted at a node (e.g. human_review)
                cur.execute(
                    "UPDATE runs SET status = 'paused', current_node = ?, updated_at = ? WHERE run_id = ?",
                    (state.next[0], now_iso, run_id)
                )
                conn.commit()
                await event_bus.emit("run_paused", {"node": state.next[0]}, run_id=run_id)
            else:
                cur.execute(
                    "UPDATE runs SET status = 'completed', updated_at = ? WHERE run_id = ?",
                    (now_iso, run_id)
                )
                conn.commit()
                await event_bus.emit("run_completed", {"summary": "done"}, run_id=run_id)
        finally:
            conn.close()

    except Exception as e:
        print(f"Error running graph for {run_id}: {e}")
        conn = get_connection()
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "UPDATE runs SET status = 'failed', updated_at = ? WHERE run_id = ?",
                (now_iso, run_id)
            )
            conn.commit()
            await event_bus.emit("run_failed", {"error": str(e)}, run_id=run_id)
        finally:
            conn.close()

@router.post("/runs", response_model=RunCreateResponse, status_code=202)
async def create_runs(
    req: RunCreateRequest,
    request: Request,
    background_tasks: BackgroundTasks
):
    now_iso = datetime.now(timezone.utc).isoformat()
    created_items: List[RunCreatedItem] = []

    conn = get_connection()
    try:
        cur = conn.cursor()
        for company_or_ticker in req.companies:
            is_toy = (company_or_ticker.upper() == "TOY")
            run_id = f"r_toy_{uuid.uuid4().hex[:6]}" if is_toy else f"r_{uuid.uuid4().hex[:6]}"
            ticker = "TOY" if is_toy else company_or_ticker.upper()
            company_name = "Toy Model Corporation" if is_toy else f"{ticker} Inc."

            cur.execute(
                """
                INSERT INTO runs (run_id, ticker, company, cik, accession, fiscal_year, status, current_node, fault_mode, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?)
                """,
                (run_id, ticker, company_name, "0000000000", "0000000000-00-000000", 2026,
                 "step_a" if is_toy else "fetch", req.fault_mode.value if req.fault_mode else None, now_iso, now_iso)
            )

            # If toy run, create initial review item
            if is_toy:
                review_id = f"rv_{run_id}"
                cur.execute(
                    """
                    INSERT INTO reviews (review_id, run_id, metric_id, round, status, reasons, created_at)
                    VALUES (?, ?, 'toy_metric', 1, 'pending', ?, ?)
                    """,
                    (review_id, run_id, json.dumps([{"code": "LOW_CONF", "text": "Toy verification required"}]), now_iso)
                )

            created_items.append(RunCreatedItem(run_id=run_id, ticker=ticker, status="queued"))

            initial_state = {
                "run_id": run_id,
                "ticker": ticker,
                "company": company_name,
                "current_review_id": f"rv_{run_id}" if is_toy else "",
                "step_a_count": 0,
                "step_b_count": 0
            }

            background_tasks.add_task(
                execute_run_graph, run_id, is_toy, request.app.state, initial_state
            )

        conn.commit()
    finally:
        conn.close()

    for item in created_items:
        await event_bus.emit("run_created", {"ticker": item.ticker, "run_id": item.run_id})

    return RunCreateResponse(runs=created_items)
