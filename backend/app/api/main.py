import os
import sqlite3
from contextlib import asynccontextmanager
from typing import Any, Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.app.config import get_config
from backend.app.db import init_db, get_connection
from backend.app.events import event_bus
from backend.app.llm import get_llm_counters
from backend.app.audit import verify_audit_chain
from backend.app.api.config import router as config_router
from backend.app.models import HealthResponse, CountersResponse, EventEnvelope

# Enforce strict msgpack serialization per RULES #11
os.environ["LANGGRAPH_STRICT_MSGPACK"] = "true"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database with WAL mode and audit triggers
    init_db()
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

    return {
        "ok": True,
        "checkpointer": "sqlite",
        "llm_calls": llm_stats["unique_llm_calls"],
        "audit_rows": audit_rows,
        "recovered_runs": []
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

@app.get("/audit/verify")
def verify_audit() -> Dict[str, Any]:
    return verify_audit_chain()

@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket, since_seq: int = Query(0)):
    await event_bus.connect(websocket)
    try:
        # Replay persisted events with seq > since_seq per CONTRACT.md
        past_events = event_bus.get_persisted_events(since_seq)
        for ev in past_events:
            await websocket.send_json(ev)

        # Keep connection open for live events
        while True:
            # Client can send heartbeats/ping
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        await event_bus.disconnect(websocket)
    except Exception:
        await event_bus.disconnect(websocket)
