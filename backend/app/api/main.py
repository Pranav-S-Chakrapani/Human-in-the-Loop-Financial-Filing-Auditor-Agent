import os
import sqlite3
from contextlib import asynccontextmanager
from typing import Any, Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from backend.app.config import get_config
from backend.app.db import init_db, get_connection
from backend.app.events import event_bus
from backend.app.llm import get_llm_counters
from backend.app.graph.build import build_toy_graph, build_pipeline_graph
from backend.app.graph.reconciler import reconcile_runs
from backend.app.models import HealthResponse, CountersResponse

from backend.app.api.config import router as config_router
from backend.app.api.audit import router as audit_router
from backend.app.api.reviews import router as reviews_router
from backend.app.api.runs import router as runs_router

# Enforce strict msgpack serialization per RULES #11
os.environ["LANGGRAPH_STRICT_MSGPACK"] = "true"

CHECKPOINTS_DB_PATH = "checkpoints.db"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize SQLite database with WAL mode and audit triggers
    init_db()

    # 2. Initialize AsyncSqliteSaver on checkpoints.db per RULES #11
    async with AsyncSqliteSaver.from_conn_string(CHECKPOINTS_DB_PATH) as checkpointer:
        await checkpointer.setup()
        app.state.checkpointer = checkpointer

        # Build graphs with durable checkpointer
        app.state.toy_graph = build_toy_graph(checkpointer)
        app.state.pipeline_graph = build_pipeline_graph(checkpointer)

        # 3. Startup reconciler (RULES #10)
        recovered = await reconcile_runs(app.state)
        app.state.recovered_runs = recovered

        yield

app = FastAPI(
    title="VantageAudit API",
    description="PS-01 Human-in-the-Loop Financial Filing Auditor",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(config_router)
app.include_router(audit_router)
app.include_router(reviews_router)
app.include_router(runs_router)

@app.get("/health", response_model=HealthResponse)
def health_check() -> Dict[str, Any]:
    """CONTRACT.md: /health -> { ok, checkpointer, llm_calls, audit_rows, recovered_runs }"""
    llm_stats = get_llm_counters()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT count(*) as cnt FROM audit_log;")
        audit_rows = cur.fetchone()["cnt"]
    except Exception:
        audit_rows = 0
    finally:
        conn.close()

    recovered = getattr(app.state, "recovered_runs", [])

    return {
        "ok": True,
        "checkpointer": "sqlite",
        "llm_calls": llm_stats["unique_llm_calls"],
        "audit_rows": audit_rows,
        "recovered_runs": recovered
    }

@app.get("/counters", response_model=CountersResponse)
def get_counters() -> Dict[str, Any]:
    """CONTRACT.md: /counters -> { llm_calls, audit_rows, events }"""
    llm_stats = get_llm_counters()
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT count(*) as cnt FROM audit_log;")
        audit_rows = cur.fetchone()["cnt"]
        cur.execute("SELECT count(*) as cnt FROM events;")
        events_cnt = cur.fetchone()["cnt"]
    except Exception:
        audit_rows = 0
        events_cnt = 0
    finally:
        conn.close()

    return {
        "llm_calls": llm_stats["unique_llm_calls"],
        "audit_rows": audit_rows,
        "events": events_cnt
    }

@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket, since_seq: int = Query(0)):
    await event_bus.connect(websocket)
    try:
        past_events = event_bus.get_persisted_events(since_seq)
        for ev in past_events:
            await websocket.send_json(ev)

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await event_bus.disconnect(websocket)
    except Exception:
        await event_bus.disconnect(websocket)
