import asyncio
import json
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.app.config import get_config, save_config, AppConfig
from backend.app.db import init_db, get_connection
from backend.app.graph.nodes.validate import validate_node, run_validation_checks
from backend.app.graph.nodes.triage import triage_node
from backend.app.graph.nodes.apply_decisions import apply_decisions_node
from backend.app.graph.nodes.revalidate import revalidate_node
from backend.app.graph.reconciler import reconcile_runs
from backend.app.faults import apply_fault
from backend.app.graph.nodes.score import score_metric
from backend.app.api.reviews import submit_review_decision
from backend.app.models import ReviewDecisionRequest
from backend.app.api.report import compute_report_metrics

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    conn = get_connection()
    try:
        conn.execute("DELETE FROM metric_corrections")
        conn.commit()
    finally:
        conn.close()

@pytest.mark.asyncio
async def test_item_1_segment_data_skipped_no_crash_no_escalation():
    """Item 1: Company with no segment data -> segment check shows skipped, no crash, no escalation."""
    rid = f"reg_seg_{uuid.uuid4().hex[:6]}"
    state = {
        "run_id": rid,
        "scored_metrics": {
            "revenue": {
                "metric": "revenue",
                "value_dollars": 500_000_000.0,
                "confidence": 0.95,
                "method": "agree"
            }
        },
        "located_statements": {}
    }
    v_res = await validate_node(state)
    assert any(v["check_type"] == "segment" and v["status"] == "skipped" for v in v_res["validations"])
    state["validations"] = v_res["validations"]

    t_res = await triage_node(state)
    assert len(t_res.get("pending_reviews", [])) == 0
    assert state["scored_metrics"]["revenue"]["decision_status"] == "auto_approved"

@pytest.mark.asyncio
async def test_item_2_missing_total_liabilities_derived_equation_passes():
    """Item 2: Company with no Total liabilities (Alphabet/Amazon) -> derived, equation passes."""
    rid = f"reg_der_{uuid.uuid4().hex[:6]}"
    state = {
        "run_id": rid,
        "scored_metrics": {
            "total_assets": {"metric": "total_assets", "value_dollars": 1000.0, "confidence": 0.9},
            "shareholders_equity": {"metric": "shareholders_equity", "value_dollars": 400.0, "confidence": 0.9}
        },
        "located_statements": {}
    }
    v_res = await validate_node(state)
    liab = v_res["scored_metrics"].get("total_liabilities")
    assert liab is not None
    assert liab["method"] == "derived"
    assert liab["value_dollars"] == 600.0

    eq_val = next(v for v in v_res["validations"] if v["check_type"] == "equation")
    assert eq_val["status"] == "passed"

@pytest.mark.asyncio
async def test_item_3_nci_handling_in_equation():
    """Item 3: Company with NCI -> equation uses NCI, no false escalation."""
    rid = f"reg_nci_{uuid.uuid4().hex[:6]}"
    html = """
    <table>
      <tr><td>Total assets</td><td>1050</td></tr>
      <tr><td>Total liabilities</td><td>600</td></tr>
      <tr><td>Stockholders equity</td><td>400</td></tr>
      <tr><td>Noncontrolling interests</td><td>50</td></tr>
    </table>
    """
    state = {
        "run_id": rid,
        "scored_metrics": {
            "total_assets": {"metric": "total_assets", "value_dollars": 1050.0, "confidence": 0.9},
            "total_liabilities": {"metric": "total_liabilities", "value_dollars": 600.0, "confidence": 0.9},
            "shareholders_equity": {"metric": "shareholders_equity", "value_dollars": 400.0, "confidence": 0.9}
        },
        "located_statements": {
            "balance_sheet": {"table_html": html, "scale": 1}
        }
    }
    v_res = await validate_node(state)
    eq_val = next(v for v in v_res["validations"] if v["check_type"] == "equation")
    assert eq_val["status"] == "passed"
    assert eq_val["detail"]["nci"] == 50.0

@pytest.mark.asyncio
async def test_item_4_forced_low_conf_escalates_with_reasons():
    """Item 4: Forced LOW_CONF (inject wrong_row) -> escalates with correct reason text."""
    cfg = get_config()
    m = {
        "metric": "revenue",
        "value_dollars": 1000.0,
        "value_a": 1000.0,
        "value_b": 1000.0,
        "source_ref": {"row": 5, "col": 1}
    }
    faulted = apply_fault(m, "wrong_row")
    conf, cb, method = score_metric(faulted["value_a"], faulted["value_b"])
    faulted["confidence"] = conf
    faulted["method"] = method

    state = {
        "run_id": f"reg_fault_{uuid.uuid4().hex[:6]}",
        "scored_metrics": {"revenue": faulted},
        "validations": []
    }
    t_res = await triage_node(state)
    assert len(t_res["pending_reviews"]) == 1
    rev = t_res["pending_reviews"][0]
    reason_codes = [r["code"] for r in rev["reasons"]]
    assert "LOW_CONF" in reason_codes
    assert rev["confidence"] < cfg.confidence_threshold

@pytest.mark.asyncio
async def test_item_5_corrected_value_flows_into_report_and_audit():
    """Item 5: Corrected value flows into final report; audit row has original and corrected."""
    rid = f"reg_corr_{uuid.uuid4().hex[:6]}"
    rev_id = f"rv_{rid}_revenue"
    metric_id = f"m_{rid}_revenue"

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO runs (run_id, company, ticker, status, current_node, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (rid, "Test Co", "TEST", "paused", "human_review", "2026-01-01", "2026-01-01")
    )
    cur.execute(
        "INSERT INTO metrics (metric_id, run_id, metric, period_label, period_end, is_current, value_dollars, confidence, decision_status, final_value, fault_injected) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (metric_id, rid, "revenue", "FY2026", "2026-09-30", 1, 100.0, 0.4, "pending_review", None, 0)
    )
    cur.execute(
        "INSERT INTO reviews (review_id, run_id, metric_id, round, status, reasons, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (rev_id, rid, metric_id, 1, "pending", json.dumps([{"code": "LOW_CONF"}]), "2026-01-01")
    )
    conn.commit()
    conn.close()

    req_mock = MagicMock()
    req_mock.app.state.toy_graph = None
    req_mock.app.state.pipeline_graph = None

    await submit_review_decision(
        rev_id,
        ReviewDecisionRequest(decision="correct", corrected_value=555.0, reviewer="user", note="Fixing number"),
        req_mock
    )

    # Check audit log row
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT original_value, corrected_value, decision FROM audit_log WHERE review_id = ?", (rev_id,))
    audit_entry = cur.fetchone()
    assert audit_entry["original_value"] == 100.0
    assert audit_entry["corrected_value"] == 555.0
    assert audit_entry["decision"] == "correct"

    # Simulate apply_decisions
    state = {
        "run_id": rid,
        "reviewed_id": rev_id,
        "human_decision": {"decision": "correct", "corrected_value": 555.0, "note": "Fixing number"}
    }
    await apply_decisions_node(state)

    cur.execute("SELECT final_value, decision_status FROM metrics WHERE metric_id = ?", (metric_id,))
    m_row = cur.fetchone()
    assert m_row["final_value"] == 555.0
    assert m_row["decision_status"] == "corrected"
    conn.close()

@pytest.mark.asyncio
async def test_item_6_reject_excluded_from_accuracy_and_counted_in_rejected():
    """Item 6: Reject -> value excluded from accuracy, counted in rejected."""
    rid = f"reg_rej_{uuid.uuid4().hex[:6]}"
    rev_id = f"rv_{rid}_revenue"
    metric_id = f"m_{rid}_revenue"

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO runs (run_id, company, ticker, status, current_node, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (rid, "Test Co", "TEST", "paused", "human_review", "2026-01-01", "2026-01-01")
    )
    cur.execute(
        "INSERT INTO metrics (metric_id, run_id, metric, period_label, period_end, is_current, value_dollars, confidence, decision_status, final_value, fault_injected) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (metric_id, rid, "revenue", "FY2026", "2026-09-30", 1, 100.0, 0.4, "pending_review", None, 0)
    )
    cur.execute(
        "INSERT INTO reviews (review_id, run_id, metric_id, round, status, reasons, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (rev_id, rid, metric_id, 1, "pending", json.dumps([{"code": "LOW_CONF"}]), "2026-01-01")
    )
    conn.commit()
    conn.close()

    # Apply reject
    state = {
        "run_id": rid,
        "reviewed_id": rev_id,
        "human_decision": {"decision": "reject", "note": "Fake data"}
    }
    await apply_decisions_node(state)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT decision_status, final_value FROM metrics WHERE metric_id = ?", (metric_id,))
    m_row = cur.fetchone()
    assert m_row["decision_status"] == "rejected"
    assert m_row["final_value"] is None

    rep = compute_report_metrics(conn)
    assert rep["totals"]["rejected"] >= 1
    conn.close()

@pytest.mark.asyncio
async def test_item_7_correction_validation_failure_two_rounds_then_unresolved():
    """Item 7: Correction that still fails validation -> exactly one more review round, then unresolved."""
    rid = f"reg_rnd_{uuid.uuid4().hex[:6]}"
    rev_id = f"rv_{rid}_total_assets"
    metric_id = f"m_{rid}_total_assets"

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO runs (run_id, company, ticker, status, current_node, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (rid, "Test Co", "TEST", "paused", "human_review", "2026-01-01", "2026-01-01")
    )
    cur.execute(
        "INSERT INTO metrics (metric_id, run_id, metric, period_label, period_end, is_current, value_dollars, confidence, decision_status, final_value, fault_injected) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (metric_id, rid, "total_assets", "FY2026", "2026-09-30", 1, 100.0, 0.4, "pending_review", None, 0)
    )
    cur.execute(
        "INSERT INTO reviews (review_id, run_id, metric_id, round, status, reasons, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (rev_id, rid, metric_id, 1, "pending", json.dumps([{"code": "LOW_CONF"}]), "2026-01-01")
    )
    conn.commit()
    conn.close()

    state = {
        "run_id": rid,
        "current_review_id": rev_id,
        "reviewed_id": rev_id,
        "scored_metrics": {
            "total_assets": {"value_dollars": 100.0, "metric": "total_assets"},
            "total_liabilities": {"value_dollars": 600.0, "metric": "total_liabilities"},
            "shareholders_equity": {"value_dollars": 400.0, "metric": "shareholders_equity"}
        },
        "located_statements": {},
        "human_decision": {"decision": "correct", "corrected_value": 200.0, "note": "Still wrong"}
    }

    # Round 1 correction: still wrong -> revalidate creates round 2
    app_res = await apply_decisions_node(state)
    state.update(app_res)
    reval_res = await revalidate_node(state)
    state.update(reval_res)

    assert len(state["review_queue"]) == 1
    assert "_r2" in state["review_queue"][0]

    # Round 2 correction: still wrong -> revalidate exceeds max_review_rounds -> unresolved
    r2_id = state["review_queue"][0]
    state["human_decision"] = {"decision": "correct", "corrected_value": 300.0, "note": "Still wrong"}
    state["reviewed_id"] = r2_id
    app_res2 = await apply_decisions_node(state)
    state.update(app_res2)
    reval_res2 = await revalidate_node(state)
    state.update(reval_res2)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT decision_status, final_value FROM metrics WHERE metric_id = ?", (metric_id,))
    final_m = cur.fetchone()
    assert final_m["decision_status"] == "unresolved"
    assert final_m["final_value"] is None
    assert len(state["review_queue"]) == 0
    conn.close()

@pytest.mark.asyncio
async def test_item_8_double_click_approve_exactly_one_audit_row():
    """Item 8: Double click on Approve -> one audit row."""
    rid = f"reg_dbl_{uuid.uuid4().hex[:6]}"
    rev_id = f"rv_{rid}_revenue"
    metric_id = f"m_{rid}_revenue"

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO runs (run_id, company, ticker, status, current_node, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (rid, "Test Co", "TEST", "paused", "human_review", "2026-01-01", "2026-01-01")
    )
    cur.execute(
        "INSERT INTO metrics (metric_id, run_id, metric, period_label, period_end, is_current, value_dollars, confidence, decision_status, final_value, fault_injected) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (metric_id, rid, "revenue", "FY2026", "2026-09-30", 1, 100.0, 0.4, "pending_review", None, 0)
    )
    cur.execute(
        "INSERT INTO reviews (review_id, run_id, metric_id, round, status, reasons, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (rev_id, rid, metric_id, 1, "pending", json.dumps([{"code": "LOW_CONF"}]), "2026-01-01")
    )
    conn.commit()
    conn.close()

    req_mock = MagicMock()
    req_mock.app.state.toy_graph = None
    req_mock.app.state.pipeline_graph = None

    req = ReviewDecisionRequest(decision="approve", reviewer="user", note="Approved")
    res1, res2 = await asyncio.gather(
        submit_review_decision(rev_id, req, req_mock),
        submit_review_decision(rev_id, req, req_mock)
    )

    assert (res1["duplicate"] is True and res2["duplicate"] is False) or (res1["duplicate"] is False and res2["duplicate"] is True)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT count(*) as cnt FROM audit_log WHERE review_id = ?", (rev_id,))
    assert cur.fetchone()["cnt"] == 1
    conn.close()

@pytest.mark.asyncio
async def test_item_9_restart_recovers_paused_and_running_runs():
    """Item 9: Restart server with 3 runs paused and 1 running -> all recover."""
    conn = get_connection()
    cur = conn.cursor()

    p_ids = []
    for i in range(3):
        rid = f"reg_p_{i}_{uuid.uuid4().hex[:4]}"
        p_ids.append(rid)
        revid = f"rv_{rid}_m"
        cur.execute(
            "INSERT INTO runs (run_id, company, ticker, status, current_node, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (rid, f"Company {i}", "TICK", "paused", "human_review", "2026-01-01", "2026-01-01")
        )
        cur.execute(
            "INSERT INTO reviews (review_id, run_id, metric_id, round, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (revid, rid, f"m_{rid}", 1, "approved", "2026-01-01")
        )
        # Use NULL for autoincrement seq and unique hashes
        cur.execute(
            "INSERT INTO audit_log (seq, row_hash, prev_hash, review_id, run_id, company, metric, period, original_value, corrected_value, decision, reviewer, note, reasons, confidence, ts) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (f"h_{uuid.uuid4().hex[:6]}", f"p_{uuid.uuid4().hex[:6]}", revid, rid, f"Company {i}", "m", "FY2026", 100, None, "approve", "user", "ok", "[]", 0.9, "2026-01-01")
        )

    rid_run = f"reg_run_{uuid.uuid4().hex[:4]}"
    cur.execute(
        "INSERT INTO runs (run_id, company, ticker, status, current_node, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (rid_run, "Running Co", "RUN", "running", "locate", "2026-01-01", "2026-01-01")
    )
    conn.commit()
    conn.close()

    app_state = MagicMock()
    app_state.toy_graph.ainvoke = AsyncMock()
    app_state.pipeline_graph.ainvoke = AsyncMock()

    recovered = await reconcile_runs(app_state)
    for rid in p_ids + [rid_run]:
        assert rid in recovered

@pytest.mark.asyncio
async def test_item_10_change_confidence_threshold_in_config():
    """Item 10: Change confidence_threshold in /config -> next run escalation count changes; report snapshot records the config."""
    cfg = get_config()
    orig_thresh = cfg.confidence_threshold
    try:
        cfg.confidence_threshold = 0.70
        save_config(cfg)
        m = {"metric": "revenue", "value_dollars": 100.0, "confidence": 0.72, "method": "agree"}
        state_70 = {"run_id": f"reg_c70_{uuid.uuid4().hex[:4]}", "scored_metrics": {"revenue": dict(m)}, "validations": []}
        res_70 = await triage_node(state_70)
        assert len(res_70.get("pending_reviews", [])) == 0

        cfg.confidence_threshold = 0.80
        save_config(cfg)
        state_80 = {"run_id": f"reg_c80_{uuid.uuid4().hex[:4]}", "scored_metrics": {"revenue": dict(m)}, "validations": []}
        res_80 = await triage_node(state_80)
        assert len(res_80.get("pending_reviews", [])) == 1

        conn = get_connection()
        rep = compute_report_metrics(conn)
        assert rep["config_snapshot"]["confidence_threshold"] == 0.80
        conn.close()
    finally:
        cfg.confidence_threshold = orig_thresh
        save_config(cfg)
