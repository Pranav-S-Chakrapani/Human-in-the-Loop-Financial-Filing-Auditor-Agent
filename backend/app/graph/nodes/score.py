from typing import Any, Dict, Optional, Tuple
from backend.app.config import get_config
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.faults import get_armed_fault, apply_fault

ALL_METRICS = [
    "revenue", "net_income", "total_assets", "total_liabilities",
    "shareholders_equity", "operating_cash_flow", "gross_profit", "diluted_eps"
]

def score_metric(
    val_rules: Optional[float],
    val_llm: Optional[float],
    label_quality: float = 1.0,
    cross_corroboration: float = 0.5
) -> Tuple[float, Dict[str, Any], str]:
    """
    SPEC §11:
    confidence = w1*(rules_vs_llm_agreement) + w2*(label_match_quality) + w3*(cross_statement_corroboration)
    Disagreement caps score at disagree_cap (default 0.4).
    """
    cfg = get_config()
    w = cfg.scoring_weights
    cap = cfg.disagree_cap

    if val_rules is None and val_llm is None:
        return 0.0, {"agree": 0.0, "label": 0.0, "cross": 0.0, "cap_applied": False}, "disagree"

    if val_rules is not None and val_llm is None:
        conf = w.agree * 0.5 + w.label * label_quality + w.cross * cross_corroboration
        return min(1.0, conf), {"agree": 0.5, "label": label_quality, "cross": cross_corroboration, "cap_applied": False}, "rules_only"

    if val_rules is None and val_llm is not None:
        conf = w.agree * 0.5 + w.label * label_quality + w.cross * cross_corroboration
        return min(1.0, conf), {"agree": 0.5, "label": label_quality, "cross": cross_corroboration, "cap_applied": False}, "llm_only"

    # Both values present
    delta = abs(val_rules - val_llm)
    denom = max(abs(val_rules), abs(val_llm), 1.0)
    relative_diff = delta / denom

    if relative_diff < 0.01:
        agree_score = 1.0
        method = "agree"
        cap_applied = False
    else:
        agree_score = 0.0
        method = "disagree"
        cap_applied = True

    raw_conf = w.agree * agree_score + w.label * label_quality + w.cross * cross_corroboration
    final_conf = min(cap, raw_conf) if cap_applied else min(1.0, raw_conf)

    breakdown = {
        "agree": agree_score,
        "label": label_quality,
        "cross": cross_corroboration,
        "sanity": 1.0,
        "cap_applied": cap_applied
    }

    return final_conf, breakdown, method

async def score_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    if is_node_completed(run_id, "score"):
        await event_bus.emit("node_skipped", {"node": "score", "reason": "already_done"}, run_id=run_id)
        return {}

    record_node_start(run_id, "score")
    await event_bus.emit("node_started", {"node": "score"}, run_id=run_id)

    rules_metrics = state.get("rules_metrics", {})
    llm_metrics = state.get("llm_metrics", {})
    ticker = state.get("ticker", "")
    armed_fault = state.get("fault_mode") or get_armed_fault(ticker)

    scored_metrics: Dict[str, Any] = {}

    for m in ALL_METRICS:
        r_item = rules_metrics.get(m, {})
        l_item = llm_metrics.get(m, {})

        # Current year
        r_curr = r_item.get("dollars_current")
        l_curr = l_item.get("dollars_current")
        conf_curr, breakdown_curr, method_curr = score_metric(r_curr, l_curr)
        chosen_curr = r_curr if r_curr is not None else l_curr

        # Prior year
        r_prior = r_item.get("dollars_prior")
        l_prior = l_item.get("dollars_prior")
        conf_prior, breakdown_prior, method_prior = score_metric(r_prior, l_prior)
        chosen_prior = r_prior if r_prior is not None else l_prior

        metric_record = {
            "metric": m,
            "value_a": r_curr,
            "value_b": l_curr,
            "value_dollars": chosen_curr,
            "prior_dollars": chosen_prior,
            "confidence": conf_curr,
            "confidence_breakdown": breakdown_curr,
            "method": method_curr,
            "scale": r_item.get("scale", 1_000_000),
            "snippet_text": r_item.get("snippet_text", ""),
            "snippet_html": r_item.get("snippet_html", ""),
            "source_ref": r_item.get("source_ref", {}),
            "fault_injected": False
        }

        # Apply fault injection if armed and matches metric
        if armed_fault and m == "revenue":
            metric_record = apply_fault(metric_record, armed_fault)

        scored_metrics[m] = metric_record

    record_node_finish(run_id, "score", "done")
    await event_bus.emit("node_completed", {"node": "score", "summary": f"Scored {len(scored_metrics)} metrics"}, run_id=run_id)

    return {"scored_metrics": scored_metrics}
