import pytest
import uuid
import os
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.types import Command
from backend.app.db import init_db, get_connection
from backend.app.graph.build import build_pipeline_graph
from backend.app.faults import arm_fault
from backend.app.llm import get_llm_counters

@pytest.mark.asyncio
async def test_full_pipeline_fault_injection_pause_resume():
    """
    Goal G3 Test:
    - Arm fault on ticker (e.g. MSFT with wrong_column)
    - Run pipeline -> pauses at human_review
    - Verify audit row created on decision
    - Decision flows to final_value
    - Verify that rerun produces zero new LLM network calls
    """
    init_db()
    ticker = "MSFT"
    arm_fault(ticker, "wrong_column")
    run_id = f"r_test_g3_{uuid.uuid4().hex[:6]}"

    async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
        await checkpointer.setup()
        pipeline = build_pipeline_graph(checkpointer)
        config = {"configurable": {"thread_id": run_id}}

        # Create initial run record in DB
        conn = get_connection()
        conn.execute(
            """
            INSERT INTO runs (run_id, ticker, company, cik, accession, fiscal_year, status, current_node, fault_mode, created_at, updated_at)
            VALUES (?, ?, 'Microsoft Corporation', '0000789019', '0001193125-26-323660', 2026, 'running', 'fetch', 'wrong_column', 'now', 'now')
            """,
            (run_id, ticker)
        )
        conn.commit()
        conn.close()

        # Step 1: Run graph until interrupt
        initial_state = {
            "run_id": run_id,
            "ticker": ticker,
            "company": "Microsoft Corporation",
            "fault_mode": "wrong_column"
        }

        res = await pipeline.ainvoke(initial_state, config)
        state_after_pause = await pipeline.aget_state(config)

        # Assert paused at human_review
        assert state_after_pause.next == ("human_review",), f"Expected paused at human_review, got {state_after_pause.next}"

        # Fetch head review
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM reviews WHERE run_id = ? AND status = 'pending' ORDER BY rowid ASC LIMIT 1", (run_id,))
        head_rev = cur.fetchone()
        assert head_rev is not None, "Pending review should be enqueued"
        review_id = head_rev["review_id"]
        metric_id = head_rev["metric_id"]
        conn.close()

        # Record LLM calls before decision and resume
        counters_before = get_llm_counters()["unique_llm_calls"]

        # Step 2: Submit decision (correct value)
        from backend.app.audit import append_audit_entry
        seq, row_hash = append_audit_entry(
            review_id=review_id,
            run_id=run_id,
            company="Microsoft Corporation",
            metric="revenue",
            period="FY2026",
            original_value=281724000000.0,
            corrected_value=331839000000.0,
            decision="correct",
            reviewer="qa_tester",
            note="Fixed wrong column fault",
            reasons=["LOW_CONF"],
            confidence=0.4
        )

        conn = get_connection()
        conn.execute("UPDATE reviews SET status = 'correct' WHERE review_id = ?", (review_id,))
        conn.commit()
        conn.close()

        # Step 3: Resume graph with Command(resume=...)
        resume_payload = {
            "decision": "correct",
            "corrected_value": 331839000000.0,
            "note": "Fixed wrong column fault",
            "reviewer": "qa_tester"
        }

        # In case there are multiple pending reviews (e.g. gross_profit rules_only), loop through until completed
        await pipeline.ainvoke(Command(resume=resume_payload), config)

        # Loop if more reviews remain
        max_loops = 10
        while max_loops > 0:
            st = await pipeline.aget_state(config)
            if not st.next:
                break
            if st.next[0] == "human_review":
                conn = get_connection()
                cur = conn.cursor()
                cur.execute("SELECT * FROM reviews WHERE run_id = ? AND status = 'pending' ORDER BY rowid ASC LIMIT 1", (run_id,))
                next_rev = cur.fetchone()
                conn.close()

                if next_rev:
                    n_id = next_rev["review_id"]
                    append_audit_entry(
                        review_id=n_id,
                        run_id=run_id,
                        company="Microsoft Corporation",
                        metric=next_rev["metric_id"],
                        period="FY2026",
                        original_value=None,
                        corrected_value=None,
                        decision="approve",
                        reviewer="qa_tester",
                        note="auto approved secondary",
                        reasons=[],
                        confidence=0.65
                    )
                    conn = get_connection()
                    conn.execute("UPDATE reviews SET status = 'approve' WHERE review_id = ?", (n_id,))
                    conn.commit()
                    conn.close()

                    await pipeline.ainvoke(Command(resume={"decision": "approve", "corrected_value": None, "note": "ok", "reviewer": "qa_tester"}), config)
            max_loops -= 1

        final_st = await pipeline.aget_state(config)
        assert len(final_st.next) == 0, f"Expected graph completed, got next={final_st.next}"

        # Assert final_value was updated with corrected_value
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT final_value, decision_status FROM metrics WHERE metric_id = ?", (metric_id,))
        m_row = cur.fetchone()
        assert m_row["decision_status"] == "corrected"
        assert m_row["final_value"] == 331839000000.0

        # Assert audit row exists
        cur.execute("SELECT * FROM audit_log WHERE review_id = ?", (review_id,))
        audit_entry = cur.fetchone()
        assert audit_entry is not None
        assert audit_entry["decision"] == "correct"
        assert audit_entry["corrected_value"] == 331839000000.0
        conn.close()

        # Step 4: Verify idempotency / zero new LLM network calls on re-invocation
        counters_after = get_llm_counters()["unique_llm_calls"]
        # Invoke again with None on completed run
        await pipeline.ainvoke(None, config)
        counters_final = get_llm_counters()["unique_llm_calls"]
        assert counters_final == counters_after, f"Expected 0 new LLM calls on rerun, was {counters_after} -> {counters_final}"
