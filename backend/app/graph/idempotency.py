import os
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple
from backend.app.db import get_connection

def is_node_completed(run_id: str, node_name: str, db_path: Optional[Path] = None) -> bool:
    """Check if a node has already completed successfully for this run."""
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT status FROM node_runs WHERE run_id = ? AND node = ?", (run_id, node_name))
        row = cur.fetchone()
        return bool(row and row["status"] == "done")
    finally:
        conn.close()

def record_node_start(run_id: str, node_name: str, db_path: Optional[Path] = None) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO node_runs (run_id, node, status, started_at, finished_at)
            VALUES (?, ?, 'running', ?, NULL)
            ON CONFLICT(run_id, node) DO UPDATE SET
                status = 'running',
                started_at = excluded.started_at
            """,
            (run_id, node_name, now_iso)
        )
        cur.execute(
            "UPDATE runs SET current_node = ?, updated_at = ? WHERE run_id = ?",
            (node_name, now_iso, run_id)
        )
        conn.commit()
    finally:
        conn.close()

def record_node_finish(run_id: str, node_name: str, status: str = "done", db_path: Optional[Path] = None) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE node_runs
            SET status = ?, finished_at = ?
            WHERE run_id = ? AND node = ?
            """,
            (status, now_iso, run_id, node_name)
        )
        cur.execute(
            "UPDATE runs SET updated_at = ? WHERE run_id = ?",
            (now_iso, run_id)
        )
        conn.commit()
    finally:
        conn.close()

    chaos_node = os.environ.get("CHAOS_KILL_AFTER_NODE")
    if chaos_node and chaos_node == node_name:
        print(f"CHAOS_KILL_AFTER_NODE triggered after {node_name}! Simulating SIGKILL (os._exit(137))...")
        os._exit(137)
