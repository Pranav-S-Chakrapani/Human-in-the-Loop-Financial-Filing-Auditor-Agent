import sqlite3
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from backend.app.db import get_connection
from backend.app.config import get_config

# Table definition for metric correction tracking
SCHEMA_ADAPTIVE_SQL = """
CREATE TABLE IF NOT EXISTS metric_corrections (
    metric TEXT PRIMARY KEY,
    correction_count INTEGER DEFAULT 0,
    last_updated TEXT
);
"""

def init_adaptive_thresholds_db(db_path: Optional[Path] = None) -> None:
    """Ensure the metric_corrections table exists."""
    conn = get_connection(db_path)
    try:
        conn.execute(SCHEMA_ADAPTIVE_SQL)
        conn.commit()
    finally:
        conn.close()

def record_metric_decision(metric: str, decision: str, db_path: Optional[Path] = None) -> int:
    """
    If reviewer decision is 'correct' or 'reject' (not approved),
    increment correction_count for that metric type.
    Returns the new correction_count.
    """
    if decision not in ("correct", "reject"):
        return get_correction_count(metric, db_path)

    init_adaptive_thresholds_db(db_path)
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO metric_corrections (metric, correction_count, last_updated)
            VALUES (?, 1, ?)
            ON CONFLICT(metric) DO UPDATE SET
                correction_count = metric_corrections.correction_count + 1,
                last_updated = excluded.last_updated
            """,
            (metric, now_iso)
        )
        conn.commit()
        cur.execute("SELECT correction_count FROM metric_corrections WHERE metric = ?", (metric,))
        row = cur.fetchone()
        return row["correction_count"] if row else 1
    finally:
        conn.close()

def get_correction_count(metric: str, db_path: Optional[Path] = None) -> int:
    """Get current correction_count for a metric type."""
    init_adaptive_thresholds_db(db_path)
    conn = get_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT correction_count FROM metric_corrections WHERE metric = ?", (metric,))
        row = cur.fetchone()
        return row["correction_count"] if row else 0
    finally:
        conn.close()

def get_adaptive_confidence_threshold(
    metric: str,
    base_threshold: Optional[float] = None,
    threshold_limit: int = 2,
    adjustment_penalty: float = 0.15,
    max_threshold: float = 0.95,
    db_path: Optional[Path] = None
) -> Tuple[float, bool]:
    """
    Calculates adaptive threshold for a metric.
    If base_threshold is not passed, defaults to cfg.confidence_threshold.
    If correction_count exceeds threshold_limit (e.g. >= 2 corrections),
    raises the bar (e.g. from 0.75 up to max_threshold 0.95),
    requiring higher confidence to auto-approve.
    Returns: (effective_threshold, is_adjusted)
    """
    if base_threshold is None:
        try:
            base_threshold = get_config().confidence_threshold
        except Exception:
            base_threshold = 0.75

    count = get_correction_count(metric, db_path)
    if count >= threshold_limit:
        adjusted = min(max_threshold, base_threshold + adjustment_penalty)
        return adjusted, True
    return base_threshold, False
