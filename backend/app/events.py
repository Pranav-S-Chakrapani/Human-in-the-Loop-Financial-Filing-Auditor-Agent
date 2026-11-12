import asyncio
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import WebSocket

from backend.app.db import get_connection

class EventBus:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path
        self._subscribers: List[WebSocket] = []
        self._lock = asyncio.Lock()

    def record_event_sync(self, event_type: str, payload: Dict[str, Any], run_id: Optional[str] = None) -> Dict[str, Any]:
        """Persist event synchronously to SQLite and return envelope."""
        now_iso = datetime.now(timezone.utc).isoformat()
        payload_str = json.dumps(payload, sort_keys=True)
        conn = get_connection(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO events (run_id, ts, type, payload) VALUES (?, ?, ?, ?)",
                (run_id, now_iso, event_type, payload_str)
            )
            seq = cursor.lastrowid
            conn.commit()
            return {
                "seq": seq,
                "ts": now_iso,
                "run_id": run_id,
                "type": event_type,
                "payload": payload
            }
        finally:
            conn.close()

    async def emit(self, event_type: str, payload: Dict[str, Any], run_id: Optional[str] = None) -> Dict[str, Any]:
        """Record and broadcast to all connected WebSockets."""
        envelope = self.record_event_sync(event_type, payload, run_id)
        await self._broadcast(envelope)
        return envelope

    async def _broadcast(self, envelope: Dict[str, Any]) -> None:
        async with self._lock:
            dead_sockets = []
            for ws in self._subscribers:
                try:
                    await ws.send_json(envelope)
                except Exception:
                    dead_sockets.append(ws)
            for ws in dead_sockets:
                if ws in self._subscribers:
                    self._subscribers.remove(ws)

    def get_persisted_events(self, since_seq: int = 0) -> List[Dict[str, Any]]:
        """Fetch all events with seq > since_seq for replay on WS connection."""
        conn = get_connection(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT seq, ts, run_id, type, payload FROM events WHERE seq > ? ORDER BY seq ASC",
                (since_seq,)
            )
            rows = cursor.fetchall()
            events = []
            for r in rows:
                events.append({
                    "seq": r["seq"],
                    "ts": r["ts"],
                    "run_id": r["run_id"],
                    "type": r["type"],
                    "payload": json.loads(r["payload"]) if r["payload"] else {}
                })
            return events
        finally:
            conn.close()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._subscribers.append(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            if websocket in self._subscribers:
                self._subscribers.remove(websocket)

event_bus = EventBus()
