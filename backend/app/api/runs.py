import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from backend.app.db import get_connection
from backend.app.events import event_bus
from backend.app.models import RunCreateRequest, RunCreateResponse, RunCreatedItem, FaultMode
from backend.app.faults import arm_fault

router = APIRouter(tags=["runs"])

class InjectFaultRequest(BaseModel):
    ticker: str
    mode: str

@router.post("/admin/inject-fault")
def inject_fault_endpoint(req: InjectFaultRequest) -> Dict[str, Any]:
    """Arms a fault for the ticker's next run per SPEC §12 and CONTRACT.md."""
    armed = arm_fault(req.ticker, req.mode)
    return {"armed": True, "ticker": req.ticker, "fault_mode": armed}

@router.get("/runs")
def list_runs() -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM runs ORDER BY created_at DESC;")
        rows = cur.fetchall()
        result = []
        for r in rows:
            run_id = r["run_id"]
            # Compute real counts from metrics and reviews
            cur.execute("SELECT count(*) as cnt FROM metrics WHERE run_id = ?", (run_id,))
            m_cnt = cur.fetchone()["cnt"]
            cur.execute("SELECT count(*) as cnt FROM metrics WHERE run_id = ? AND decision_status = 'auto_approved'", (run_id,))
            auto_cnt = cur.fetchone()["cnt"]
            cur.execute("SELECT count(*) as cnt FROM reviews WHERE run_id = ? AND status = 'pending'", (run_id,))
            pend_cnt = cur.fetchone()["cnt"]
            cur.execute("SELECT count(*) as cnt FROM reviews WHERE run_id = ? AND status != 'pending'", (run_id,))
            decided_cnt = cur.fetchone()["cnt"]

            result.append({
                "run_id": r["run_id"],
                "company": r["company"],
                "ticker": r["ticker"],
                "fiscal_year": r["fiscal_year"] or 2026,
                "status": r["status"],
                "current_node": r["current_node"],
                "counts": {
                    "metrics": m_cnt,
                    "auto_approved": auto_cnt,
                    "pending": pend_cnt,
                    "decided": decided_cnt
                },
                "created_at": r["created_at"],
                "updated_at": r["updated_at"]
            })
        return result
    finally:
        conn.close()

@router.get("/runs/{run_id}")
def get_run(run_id: str) -> Dict[str, Any]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,))
        run_row = cur.fetchone()
        if not run_row:
            raise HTTPException(status_code=404, detail="Run not found")

        cur.execute("SELECT node, status, finished_at FROM node_runs WHERE run_id = ?", (run_id,))
        node_rows = cur.fetchall()
        nodes = [{"node": n["node"], "status": n["status"], "finished_at": n["finished_at"]} for n in node_rows]

        cur.execute("SELECT * FROM metrics WHERE run_id = ?", (run_id,))
        metric_rows = cur.fetchall()
        metrics = []
        for m in metric_rows:
            try:
                cb = json.loads(m["confidence_breakdown"]) if m["confidence_breakdown"] else None
                sr = json.loads(m["source_ref"]) if m["source_ref"] else None
                gt = json.loads(m["ground_truth"]) if m["ground_truth"] else None
            except Exception:
                cb, sr, gt = None, None, None

            metrics.append({
                "metric_id": m["metric_id"],
                "run_id": m["run_id"],
                "metric": m["metric"],
                "period_label": m["period_label"],
                "period_end": m["period_end"],
                "is_current": bool(m["is_current"]),
                "unit_label": m["unit_label"],
                "scale": m["scale"],
                "value_a": m["value_a"],
                "value_b": m["value_b"],
                "value_dollars": m["value_dollars"],
                "snippet_text": m["snippet_text"],
                "snippet_html": m["snippet_html"],
                "source_ref": sr,
                "confidence": m["confidence"],
                "confidence_breakdown": cb,
                "method": m["method"],
                "decision_status": m["decision_status"],
                "final_value": m["final_value"],
                "fault_injected": bool(m["fault_injected"]),
                "ground_truth": gt
            })

        cur.execute("SELECT * FROM validations WHERE run_id = ?", (run_id,))
        val_rows = cur.fetchall()
        validations = []
        for v in val_rows:
            try:
                detail = json.loads(v["detail"]) if v["detail"] else None
            except Exception:
                detail = None
            validations.append({
                "validation_id": v["validation_id"],
                "check_type": v["check_type"],
                "metric": v["metric_id"].replace(f"m_{run_id}_", ""),
                "status": v["status"],
                "phase": v["phase"],
                "detail": detail,
                "explanation": v["explanation"]
            })

        return {
            "run_id": run_row["run_id"],
            "company": run_row["company"],
            "ticker": run_row["ticker"],
            "cik": run_row["cik"],
            "accession": run_row["accession"],
            "fiscal_year": run_row["fiscal_year"],
            "status": run_row["status"],
            "current_node": run_row["current_node"],
            "fault_mode": run_row["fault_mode"],
            "nodes": nodes,
            "metrics": metrics,
            "validations": validations,
            "last_checkpoint_at": run_row["updated_at"]
        }
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
                    "UPDATE runs SET status = 'completed', current_node = 'done', updated_at = ? WHERE run_id = ?",
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
    if getattr(request.app.state, "maintenance_mode", False):
        raise HTTPException(
            status_code=503,
            detail="System is currently performing maintenance/demo reset. Please retry shortly."
        )

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
                "fault_mode": req.fault_mode.value if req.fault_mode else None,
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
