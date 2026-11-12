import uuid
import pytest
from backend.app.graph.nodes.parser_utils import parse_financial_number, detect_scale_multiplier
from backend.app.graph.nodes.score import score_metric
from backend.app.config import get_config

def test_number_normalization():
    # Negative in parentheses
    assert parse_financial_number("(1,234)") == -1234.0
    assert parse_financial_number("( 567.89 )") == -567.89

    # Standard positive with commas and currency
    assert parse_financial_number("$1,234,567") == 1234567.0
    assert parse_financial_number("  $ 404,548  ") == 404548.0

    # Dash as zero
    assert parse_financial_number("—") == 0.0
    assert parse_financial_number("-") == 0.0
    assert parse_financial_number("–") == 0.0

    # Footnotes and non-numbers
    assert parse_financial_number("See accompanying notes") is None
    assert parse_financial_number("") is None

def test_scale_multiplier_detection():
    assert detect_scale_multiplier("Amounts in millions, except per share") == 1_000_000
    assert detect_scale_multiplier("(In Thousands, except per share data)") == 1_000
    assert detect_scale_multiplier("All values in billions of dollars") == 1_000_000_000
    assert detect_scale_multiplier("Exact dollar amounts") == 1

def test_scoring_agreement_and_disagree_cap():
    cfg = get_config()
    # Perfect agreement
    conf, breakdown, method = score_metric(val_rules=100.0, val_llm=100.0)
    assert method == "agree"
    assert not breakdown["cap_applied"]
    assert conf >= 0.8

    # Disagreement caps at disagree_cap (0.4)
    conf_dis, breakdown_dis, method_dis = score_metric(val_rules=100.0, val_llm=250.0)
    assert method_dis == "disagree"
    assert breakdown_dis["cap_applied"]
    assert conf_dis <= cfg.disagree_cap

@pytest.mark.asyncio
async def test_equation_validation_and_derived_liabilities():
    from backend.app.graph.nodes.validate import validate_node

    run_id_1 = f"t_pass_eq_{uuid.uuid4().hex[:6]}"
    state_passing = {
        "run_id": run_id_1,
        "scored_metrics": {
            "total_assets": {"value_dollars": 1000.0, "prior_dollars": 900.0},
            "total_liabilities": {"value_dollars": 600.0, "prior_dollars": 550.0},
            "shareholders_equity": {"value_dollars": 400.0, "prior_dollars": 350.0}
        },
        "located_statements": {}
    }
    res = await validate_node(state_passing)
    eq_val = next(v for v in res["validations"] if v["check_type"] == "equation")
    assert eq_val["status"] == "passed"

    # Case 2: Missing total_liabilities is derived
    run_id_2 = f"t_der_eq_{uuid.uuid4().hex[:6]}"
    state_derived = {
        "run_id": run_id_2,
        "scored_metrics": {
            "total_assets": {"value_dollars": 1000.0, "prior_dollars": 900.0},
            "total_liabilities": {"value_dollars": None, "prior_dollars": None},
            "shareholders_equity": {"value_dollars": 400.0, "prior_dollars": 350.0}
        },
        "located_statements": {}
    }
    res_der = await validate_node(state_derived)
    assert res_der["scored_metrics"]["total_liabilities"]["method"] == "derived"
    assert res_der["scored_metrics"]["total_liabilities"]["value_dollars"] == 600.0

@pytest.mark.asyncio
async def test_yoy_threshold_anomaly():
    from backend.app.graph.nodes.validate import validate_node
    run_id = f"t_yoy_{uuid.uuid4().hex[:6]}"
    state_yoy = {
        "run_id": run_id,
        "scored_metrics": {
            "revenue": {"value_dollars": 3000.0, "prior_dollars": 1000.0}
        },
        "located_statements": {}
    }
    res = await validate_node(state_yoy)
    yoy_val = next(v for v in res["validations"] if v["check_type"] == "yoy")
    assert yoy_val["status"] == "failed"
    assert yoy_val["detail"]["pct_change"] == 200.0

@pytest.mark.asyncio
async def test_segment_graceful_skip():
    from backend.app.graph.nodes.validate import validate_node
    run_id = f"t_seg_{uuid.uuid4().hex[:6]}"
    state_seg = {
        "run_id": run_id,
        "scored_metrics": {},
        "located_statements": {}
    }
    res = await validate_node(state_seg)
    seg_val = next(v for v in res["validations"] if v["check_type"] == "segment")
    assert seg_val["status"] == "skipped"
    assert seg_val["detail"]["reason"] == "no segment table found"
