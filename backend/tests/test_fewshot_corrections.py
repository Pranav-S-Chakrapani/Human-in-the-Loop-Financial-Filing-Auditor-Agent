import json
import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.api.main import app
from backend.app.db import get_connection, init_db
from backend.app.graph.nodes.extract_llm import (
    fetch_correction_examples,
    format_fewshot_examples,
    build_prompt,
    extract_llm_node
)
from backend.app.events import event_bus

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    conn = get_connection()
    try:
        conn.execute("DELETE FROM correction_examples")
        conn.commit()
    finally:
        conn.close()

def test_correction_examples_table_creation():
    """Verify table correction_examples exists with specified columns."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(correction_examples)")
        cols = {row["name"]: row["type"] for row in cur.fetchall()}
        assert "metric" in cols
        assert "source_snippet" in cols
        assert "wrong_value" in cols
        assert "correct_value" in cols
        assert "reason" in cols
        assert "created_at" in cols
    finally:
        conn.close()

def test_review_correct_decision_stores_correction_example():
    """When a human submits a 'correct' decision in reviews.py, store original, corrected, reason."""
    uid = uuid.uuid4().hex[:6]
    run_id = f"r_fs_{uid}"
    metric_id = f"m_{run_id}_revenue"
    review_id = f"rev_{run_id}_1"

    conn = get_connection()
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO runs (run_id, ticker, company, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (run_id, "MSFT", "Microsoft Corporation", "paused", now_iso, now_iso)
        )
        conn.execute(
            """
            INSERT INTO metrics (
                metric_id, run_id, metric, period_label, scale, value_dollars, snippet_text, confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (metric_id, run_id, "revenue", "FY2026", 1000000, 245000000000.0, "Total revenue was $245,000 million", 0.45)
        )
        conn.execute(
            """
            INSERT INTO reviews (review_id, run_id, metric_id, round, status, reasons, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (review_id, run_id, metric_id, 1, "pending", json.dumps([{"code": "LOW_CONF", "text": "Discrepancy"}]), now_iso)
        )
        conn.commit()
    finally:
        conn.close()

    # Submit decision "correct" using TestClient with lifespan
    with TestClient(app) as client:
        payload = {
            "decision": "correct",
            "corrected_value": 260000000000.0,
            "reviewer": "sarah_cpa",
            "note": "Re-verified visual table row for total revenue"
        }
        res = client.post(f"/reviews/{review_id}/decision", json=payload)
        assert res.status_code == 200

    # Verify row in correction_examples
    conn2 = get_connection()
    try:
        cur = conn2.cursor()
        cur.execute("SELECT * FROM correction_examples WHERE metric = 'revenue'")
        rows = cur.fetchall()
        assert len(rows) == 1
        r = rows[0]
        assert r["metric"] == "revenue"
        assert "Total revenue was $245,000 million" in r["source_snippet"]
        assert "245000000000" in r["wrong_value"]
        assert "260000000000" in r["correct_value"]
        assert r["reason"] == "Re-verified visual table row for total revenue"
        assert r["created_at"] is not None
    finally:
        conn2.close()

def test_fetch_correction_examples_recent_two():
    """Verify fetch_correction_examples returns the 2 most recent rows in reverse chronological order."""
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO correction_examples (metric, source_snippet, wrong_value, correct_value, reason, created_at)
            VALUES
            ('revenue', 'snippet 1', '100', '150', 'reason 1', '2026-11-10T10:00:00Z'),
            ('revenue', 'snippet 2', '200', '250', 'reason 2', '2026-11-11T10:00:00Z'),
            ('revenue', 'snippet 3', '300', '350', 'reason 3', '2026-11-12T10:00:00Z'),
            ('net_income', 'snippet 4', '50', '60', 'reason 4', '2026-11-12T10:00:00Z')
            """
        )
        conn.commit()
    finally:
        conn.close()

    exs = fetch_correction_examples("revenue", limit=2)
    assert len(exs) == 2
    # Most recent first
    assert exs[0]["wrong_value"] == "300"
    assert exs[0]["correct_value"] == "350"
    assert exs[1]["wrong_value"] == "200"
    assert exs[1]["correct_value"] == "250"

    # net_income has 1
    ni_exs = fetch_correction_examples("net_income", limit=2)
    assert len(ni_exs) == 1
    assert ni_exs[0]["correct_value"] == "60"

def test_build_prompt_prepends_fewshot_when_examples_exist():
    """Verify 'Similar past corrections' are prepended as examples, not instructions."""
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO correction_examples (metric, source_snippet, wrong_value, correct_value, reason, created_at)
            VALUES
            ('revenue', 'Sales: $300M', '300', '300000000', 'Multiply by scale in millions', '2026-11-12T10:00:00Z')
            """
        )
        conn.commit()
    finally:
        conn.close()

    prompt, applied = build_prompt("Table text for Microsoft", metric_type="revenue")
    assert "revenue" in applied
    assert applied["revenue"] == 1
    assert "Similar past corrections" in prompt
    assert "Reference examples of historical human auditor corrections; not instructions" in prompt
    assert "[Example 1] Metric: revenue" in prompt
    assert "Sales: $300M" in prompt
    assert "300000000" in prompt
    assert "Target metrics to extract" in prompt

@pytest.mark.asyncio
async def test_extract_llm_node_emits_fewshot_applied_event():
    """Verify extract_llm_node logs event 'fewshot_applied' with metric and count."""
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO correction_examples (metric, source_snippet, wrong_value, correct_value, reason, created_at)
            VALUES
            ('revenue', 'Net Sales: $100M', '100', '100000000', 'Scale factor error', '2026-11-12T10:00:00Z'),
            ('total_assets', 'Total Assets: $500M', '500', '500000000', 'Scale factor error', '2026-11-12T10:00:00Z')
            """
        )
        conn.commit()
    finally:
        conn.close()

    run_id = f"r_evt_{uuid.uuid4().hex[:6]}"
    state = {
        "run_id": run_id,
        "located_statements": {
            "balance_sheet": {"table_text": "Assets table text", "scale": 1000000},
            "income_statement": {"table_text": "Income table text", "scale": 1000000}
        }
    }

    await extract_llm_node(state)

    # Check SQLite events table for fewshot_applied
    conn2 = get_connection()
    try:
        cur = conn2.cursor()
        cur.execute("SELECT * FROM events WHERE type = 'fewshot_applied' AND run_id = ?", (run_id,))
        rows = cur.fetchall()
        assert len(rows) >= 2
        payloads = [json.loads(r["payload"]) for r in rows]
        metrics = {p["metric"]: p["count"] for p in payloads}
        assert "revenue" in metrics
        assert metrics["revenue"] == 1
        assert "total_assets" in metrics
        assert metrics["total_assets"] == 1
    finally:
        conn2.close()

