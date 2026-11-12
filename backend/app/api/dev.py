import os
import shutil
import sqlite3
from pathlib import Path
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Request

from backend.app.db import DB_PATH, init_db, get_connection
from backend.app.events import event_bus

router = APIRouter(tags=["dev"])

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
CHECKPOINTS_DB_PATH = BACKEND_DIR / "checkpoints.db"
TABLES_CACHE_DIR = Path("data/cache/tables")

def is_demo_reset_enabled() -> bool:
    val = os.getenv("DEMO_RESET_ENABLED", "").strip().lower()
    return val in ("true", "1", "yes", "on")

@router.get("/dev/status")
def dev_status() -> Dict[str, Any]:
    """Returns dev capability status (e.g. if demo reset is enabled)."""
    return {
        "demo_reset_enabled": is_demo_reset_enabled()
    }

@router.post("/dev/reset-demo")
async def reset_demo_endpoint(request: Request) -> Dict[str, Any]:
    """
    POST /dev/reset-demo
    Gated behind DEMO_RESET_ENABLED=true (off by default).
    Stops accepting new runs briefly, deletes all rows from:
      runs, node_runs, metrics, validations, reviews, audit_log, events
    and resets the SQLite files to a fresh schema via init_db().
    """
    if not is_demo_reset_enabled():
        raise HTTPException(
            status_code=403,
            detail="Demo reset is disabled. Set DEMO_RESET_ENABLED=true to enable."
        )

    # 1. Stop accepting new runs briefly via app.state lock/flag
    app = request.app
    app.state.maintenance_mode = True

    try:
        # 2. Reset app.db tables and re-run init_db()
        conn = get_connection()
        try:
            # Temporarily drop triggers preventing audit_log delete
            conn.execute("DROP TRIGGER IF EXISTS audit_no_update")
            conn.execute("DROP TRIGGER IF EXISTS audit_no_delete")

            # Delete rows from all specified demo tables
            tables_to_clear = [
                "runs",
                "node_runs",
                "metrics",
                "validations",
                "reviews",
                "audit_log",
                "events",
                "metric_corrections"
            ]
            for tbl in tables_to_clear:
                if tbl == "metric_corrections":
                    conn.execute("DROP TABLE IF EXISTS metric_corrections")
                else:
                    conn.execute(f"DELETE FROM {tbl}")

            conn.commit()
        finally:
            conn.close()

        # Re-initialize schema and re-apply triggers via init_db()
        init_db()

        # 3. Clear checkpoints in checkpoints.db if present
        if CHECKPOINTS_DB_PATH.exists():
            try:
                cp_conn = sqlite3.connect(CHECKPOINTS_DB_PATH)
                cp_conn.execute("DELETE FROM writes")
                cp_conn.execute("DELETE FROM checkpoints")
                cp_conn.commit()
                cp_conn.close()
            except Exception as e:
                print(f"Warning: Failed to clear checkpoints: {e}")

        # 4. Clear table html caches
        if TABLES_CACHE_DIR.exists():
            for item in TABLES_CACHE_DIR.iterdir():
                try:
                    if item.is_dir():
                        shutil.rmtree(item, ignore_errors=True)
                    elif item.is_file():
                        item.unlink(missing_ok=True)
                except Exception:
                    pass

        # 5. Reset app-level state
        app.state.recovered_runs = []

        return {
            "status": "success",
            "message": "Demo data reset successfully. All runs, reviews, metrics, and audit records cleared."
        }
    finally:
        app.state.maintenance_mode = False
