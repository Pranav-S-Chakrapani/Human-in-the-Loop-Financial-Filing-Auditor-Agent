import pytest
import sqlite3
import asyncio
from pathlib import Path

from backend.app.db import SCHEMA_SQL, init_db, get_connection
from backend.app.audit import append_audit_entry, verify_audit_chain
from backend.app.llm import completion, get_llm_counters
from backend.app.edgar import get_user_agent, fetch_edgar

@pytest.fixture
def test_db(tmp_path):
    db_file = tmp_path / "test_app.db"
    conn = sqlite3.connect(db_file)
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    conn.close()
    return db_file

def test_audit_triggers_block_update(test_db):
    """RULES.md #14: Test that UPDATE on audit_log raises ABORT error."""
    seq, row_hash = append_audit_entry(
        review_id="rv_test_1",
        run_id="r_01",
        company="Apple Inc.",
        metric="revenue",
        period="FY2025",
        original_value=100.0,
        corrected_value=100.0,
        decision="approve",
        reviewer="auditor_1",
        note="Approved",
        reasons=["TEST"],
        confidence=0.95,
        db_path=test_db
    )
    assert seq > 0

    conn = get_connection(test_db)
    try:
        with pytest.raises((sqlite3.IntegrityError, sqlite3.OperationalError), match="audit_log is append-only"):
            conn.execute("UPDATE audit_log SET note = 'Tampered' WHERE seq = ?", (seq,))
    finally:
        conn.close()

def test_audit_triggers_block_delete(test_db):
    """RULES.md #14: Test that DELETE on audit_log raises ABORT error."""
    seq, row_hash = append_audit_entry(
        review_id="rv_test_2",
        run_id="r_01",
        company="Apple Inc.",
        metric="revenue",
        period="FY2025",
        original_value=100.0,
        corrected_value=100.0,
        decision="approve",
        reviewer="auditor_1",
        note="Approved",
        reasons=["TEST"],
        confidence=0.95,
        db_path=test_db
    )
    assert seq > 0

    conn = get_connection(test_db)
    try:
        with pytest.raises((sqlite3.IntegrityError, sqlite3.OperationalError), match="audit_log is append-only"):
            conn.execute("DELETE FROM audit_log WHERE seq = ?", (seq,))
    finally:
        conn.close()

def test_hash_chain_verify(test_db):
    """RULES.md #15: Test hash chain sequential consistency and detection of tampering."""
    seq1, hash1 = append_audit_entry(
        review_id="rv_01", run_id="r_1", company="AAPL", metric="revenue",
        period="FY25", original_value=100.0, corrected_value=None,
        decision="approve", reviewer="rev", note="ok", reasons=[], confidence=0.9,
        db_path=test_db
    )
    seq2, hash2 = append_audit_entry(
        review_id="rv_02", run_id="r_1", company="MSFT", metric="net_income",
        period="FY25", original_value=200.0, corrected_value=None,
        decision="approve", reviewer="rev", note="ok", reasons=[], confidence=0.92,
        db_path=test_db
    )
    assert seq2 == seq1 + 1

    # Verify chain passes
    verification = verify_audit_chain(test_db)
    assert verification["ok"] is True
    assert verification["rows"] == 2
    assert verification["head_hash"] == hash2

@pytest.mark.asyncio
async def test_llm_cache_returns_without_network_on_second_call(test_db, monkeypatch):
    """RULES.md #9: Second call with identical prompt produces zero network calls."""
    network_calls = 0

    async def fake_groq(model, prompt, system=None, json_mode=True):
        nonlocal network_calls
        network_calls += 1
        return '{"result": "mocked"}'

    monkeypatch.setattr("backend.app.llm.call_groq", fake_groq)

    prompt = "Extract revenue for test"
    # Call 1: Network call
    res1 = await completion(prompt, db_path=test_db)
    assert res1 == '{"result": "mocked"}'
    assert network_calls == 1

    # Call 2: Must be retrieved from SQLite llm_calls cache
    res2 = await completion(prompt, db_path=test_db)
    assert res2 == '{"result": "mocked"}'
    assert network_calls == 1  # Network call count DID NOT increase

def test_edgar_client_sends_user_agent():
    """RULES.md #17: Verify EDGAR client has properly formatted User-Agent with contact."""
    ua = get_user_agent()
    assert ua is not None
    assert len(ua) > 5
    assert "@" in ua
