import sqlite3
import aiosqlite
from pathlib import Path
from typing import Optional

DB_PATH = Path("app.db")

SCHEMA_SQL = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  ticker TEXT,
  company TEXT,
  cik TEXT,
  accession TEXT,
  fiscal_year INTEGER,
  status TEXT,
  current_node TEXT,
  fault_mode TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS node_runs (
  run_id TEXT,
  node TEXT,
  status TEXT,
  started_at TEXT,
  finished_at TEXT,
  PRIMARY KEY (run_id, node)
);

CREATE TABLE IF NOT EXISTS metrics (
  metric_id TEXT PRIMARY KEY,
  run_id TEXT,
  metric TEXT,
  period_label TEXT,
  period_end TEXT,
  is_current INTEGER,
  unit_label TEXT,
  scale INTEGER,
  value_a REAL,
  value_b REAL,
  value_dollars REAL,
  snippet_text TEXT,
  snippet_html TEXT,
  source_ref TEXT, -- JSON
  confidence REAL,
  confidence_breakdown TEXT, -- JSON
  method TEXT,
  decision_status TEXT,
  final_value REAL,
  fault_injected INTEGER DEFAULT 0,
  ground_truth TEXT -- JSON, nullable
);

CREATE TABLE IF NOT EXISTS validations (
  validation_id TEXT PRIMARY KEY,
  run_id TEXT,
  metric_id TEXT,
  check_type TEXT,
  status TEXT,
  phase TEXT,
  detail TEXT,
  explanation TEXT -- JSON
);

CREATE TABLE IF NOT EXISTS reviews (
  review_id TEXT PRIMARY KEY,
  run_id TEXT,
  metric_id TEXT,
  round INTEGER,
  status TEXT,
  reasons TEXT, -- JSON array of {code,text}
  created_at TEXT,
  UNIQUE(run_id, metric_id, round)
);

CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id TEXT UNIQUE,
  run_id TEXT,
  company TEXT,
  metric TEXT,
  period TEXT,
  original_value REAL,
  corrected_value REAL,
  decision TEXT,
  reviewer TEXT,
  note TEXT,
  reasons TEXT,
  confidence REAL,
  ts TEXT,
  prev_hash TEXT,
  row_hash TEXT
);

CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  ts TEXT,
  type TEXT,
  payload TEXT
);

CREATE TABLE IF NOT EXISTS llm_calls (
  cache_key TEXT PRIMARY KEY, -- sha256(model+prompt)
  model TEXT,
  response TEXT,
  ts TEXT
);

CREATE TABLE IF NOT EXISTS http_cache (
  cache_key TEXT PRIMARY KEY,
  url TEXT,
  response_body TEXT,
  status INTEGER,
  ts TEXT
);

-- append-only triggers (RULES #14)
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
"""

def init_db(db_path: Optional[Path] = None) -> None:
    target = db_path or DB_PATH
    conn = sqlite3.connect(target)
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()

def get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    target = db_path or DB_PATH
    conn = sqlite3.connect(target)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

async def get_async_connection(db_path: Optional[Path] = None) -> aiosqlite.Connection:
    target = db_path or DB_PATH
    conn = await aiosqlite.connect(target)
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON;")
    return conn
