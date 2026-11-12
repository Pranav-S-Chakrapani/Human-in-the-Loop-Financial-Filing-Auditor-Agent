import asyncio
import uuid
import pytest
from backend.app.db import init_db, get_connection
from backend.app.audit import append_audit_entry

@pytest.mark.asyncio
async def test_concurrent_double_submit_decision():
    """
    EVAL Task 6:
    POST same decision twice concurrently; exactly one audit row created.
    Uses append_audit_entry which enforces UNIQUE review_id and BEGIN IMMEDIATE.
    """
    init_db()
    test_review_id = f"rv_double_{uuid.uuid4().hex[:6]}"
    run_id = f"r_double_{uuid.uuid4().hex[:6]}"

    async def submit_worker():
        try:
            return append_audit_entry(
                review_id=test_review_id,
                run_id=run_id,
                company="Double Test Corp",
                metric="revenue",
                period="FY2026",
                original_value=100.0,
                corrected_value=150.0,
                decision="correct",
                reviewer="tester",
                note="double test",
                reasons=["LOW_CONF"],
                confidence=0.5
            )
        except Exception as e:
            return e

    # Execute two concurrent submissions
    results = await asyncio.gather(submit_worker(), submit_worker(), return_exceptions=True)

    # Count actual rows in audit_log for this review_id
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT count(*) as cnt FROM audit_log WHERE review_id = ?", (test_review_id,))
    count = cur.fetchone()["cnt"]
    conn.close()

    assert count == 1, f"Expected exactly 1 audit row for duplicate decision, found {count}"
