import pytest
import sqlite3
import asyncio
import uuid
from pathlib import Path
from fastapi.testclient import TestClient
from langgraph.types import Command
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from backend.app.api.main import app
from backend.app.db import init_db, get_connection
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.graph.nodes.fetch import fetch_node
from backend.app.audit import append_audit_entry, verify_audit_chain

def test_tamper_endpoint_reports_both_blocked():
    """CONTRACT.md /admin/tamper: Both UPDATE and DELETE are blocked by triggers."""
    with TestClient(app) as client:
        resp = client.post("/admin/tamper")
        assert resp.status_code == 200
        data = resp.json()
        assert data["update_blocked"] is True
        assert data["delete_blocked"] is True
        assert len(data["errors"]) == 2
        assert all("audit_log is append-only" in err for err in data["errors"])

def test_duplicate_post_decision_returns_duplicate_true():
    """RULES.md #10 & SPEC.md §10: Repeating decision POST returns duplicate:true with one audit row."""
    with TestClient(app) as client:
        # 1. Create a toy run
        resp_run = client.post("/runs", json={"companies": ["TOY"]})
        assert resp_run.status_code == 202
        run_data = resp_run.json()["runs"][0]
        run_id = run_data["run_id"]

        # Wait briefly for background task to pause at human_review
        import time
        time.sleep(0.5)

        # 2. Get the pending review id
        rev_resp = client.get(f"/reviews?run_id={run_id}")
        assert rev_resp.status_code == 200
        reviews = rev_resp.json()
        assert len(reviews) > 0
        review_id = reviews[0]["review_id"]

        # 3. Post first decision
        payload = {
            "decision": "correct",
            "corrected_value": 42.0,
            "reviewer": "auditor_alice",
            "note": "Correction verified"
        }
        dec_1 = client.post(f"/reviews/{review_id}/decision", json=payload)
        assert dec_1.status_code == 200
        d1 = dec_1.json()
        assert d1["duplicate"] is False
        seq1 = d1["audit_seq"]

        # 4. Post duplicate decision
        dec_2 = client.post(f"/reviews/{review_id}/decision", json=payload)
        assert dec_2.status_code == 200
        d2 = dec_2.json()
        assert d2["duplicate"] is True
        assert d2["audit_seq"] == seq1

        # 5. Verify only 1 audit row was appended for this review
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT count(*) as cnt FROM audit_log WHERE review_id = ?", (review_id,))
            assert cur.fetchone()["cnt"] == 1
        finally:
            conn.close()

@pytest.mark.asyncio
async def test_resume_after_simulated_restart_does_not_rerun_step_a(tmp_path):
    """
    RULES.md #8 & #10:
    When a thread pauses at human_review, restart is simulated.
    Resuming the thread must execute step_b without re-running step_a.
    """
    from backend.app.graph.build import build_toy_graph

    cp_file = tmp_path / "checkpoints_test.db"
    async with AsyncSqliteSaver.from_conn_string(str(cp_file)) as checkpointer:
        await checkpointer.setup()
        graph = build_toy_graph(checkpointer)

        run_id = f"r_toy_restart_{uuid.uuid4().hex[:6]}"
        config = {"configurable": {"thread_id": run_id}}
        init_state = {
            "run_id": run_id,
            "ticker": "TOY",
            "step_a_count": 0,
            "step_b_count": 0
        }

        # Step 1: Run until interrupt at human_review
        await graph.ainvoke(init_state, config)
        state_paused = await graph.aget_state(config)
        assert state_paused.next == ("human_review",)
        assert state_paused.values["step_a_count"] == 1

        # Step 2: Simulate process crash and restart with a fresh graph on the same checkpoint db
        fresh_graph = build_toy_graph(checkpointer)

        # Step 3: Resume execution passing resume command
        await fresh_graph.ainvoke(Command(resume={"decision": "approve"}), config)
        state_finished = await fresh_graph.aget_state(config)

        # Confirm step_a was NOT executed a second time (count remains 1)
        assert state_finished.values["step_a_count"] == 1
        # Confirm step_b executed
        assert state_finished.values["step_b_count"] == 1
        assert state_finished.next == ()

@pytest.mark.asyncio
async def test_real_fetch_node_aapl():
    """G1 real fetch node: AAPL ticker -> pinned accession from companies.json -> cached primary doc."""
    run_id = f"r_fetch_{uuid.uuid4().hex[:6]}"
    state = {
        "run_id": run_id,
        "ticker": "AAPL"
    }
    result = await fetch_node(state)
    assert result["cik"] == "0000320193"
    assert result["accession"] == "0000320193-26-000026"
    assert result["fiscal_year"] == 2026
    assert Path(result["doc_html_path"]).exists()
    assert "10k.html" in result["doc_html_path"]
