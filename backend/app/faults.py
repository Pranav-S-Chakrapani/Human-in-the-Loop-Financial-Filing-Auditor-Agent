from typing import Any, Dict, Optional

# Active in-memory armed faults: {ticker.upper(): mode}
_ARMED_FAULTS: Dict[str, str] = {}

def arm_fault(ticker: str, mode: str) -> None:
    _ARMED_FAULTS[ticker.upper()] = mode

def get_armed_fault(ticker: str) -> Optional[str]:
    return _ARMED_FAULTS.get(ticker.upper())

def consume_armed_fault(ticker: str) -> Optional[str]:
    """Retrieve and clear armed fault for ticker (single-shot per run)."""
    return _ARMED_FAULTS.pop(ticker.upper(), None)

def apply_fault(metric_dict: Dict[str, Any], fault_mode: str) -> Dict[str, Any]:
    """
    Applies fault mode: wrong_column | wrong_scale | wrong_row | llm_hallucination.
    Tags fault_injected=1 per RULES #3.
    """
    res = dict(metric_dict)
    res["fault_injected"] = True

    val = res.get("value_dollars")
    if val is None:
        return res

    if fault_mode == "wrong_scale":
        # Multiplied by 1000 or divided by 1000
        res["value_dollars"] = val * 1000.0
        if res.get("value_a") is not None:
            res["value_a"] = res["value_a"] * 1000.0
        if res.get("value_b") is not None:
            res["value_b"] = res["value_b"] * 1000.0
    elif fault_mode == "wrong_column":
        # Displace value significantly (e.g. 5x shift or prior column swapped)
        res["value_dollars"] = val * 0.4
        if res.get("value_a") is not None:
            res["value_a"] = res["value_a"] * 0.4
    elif fault_mode == "wrong_row":
        # Substituted with arbitrary row value
        res["value_dollars"] = val + 12345000000.0
        if res.get("value_a") is not None:
            res["value_a"] = res["value_a"] + 12345.0
    elif fault_mode == "llm_hallucination":
        # LLM extractor output corrupted
        res["value_b"] = (res.get("value_b") or val) * 2.718
        # Extractor disagreement will trigger cap

    return res
