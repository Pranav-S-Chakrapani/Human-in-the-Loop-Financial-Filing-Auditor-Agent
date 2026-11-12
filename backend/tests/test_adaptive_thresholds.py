import uuid
import pytest
from backend.app.adaptive import (
    init_adaptive_thresholds_db,
    record_metric_decision,
    get_correction_count,
    get_adaptive_confidence_threshold
)

def test_adaptive_thresholds_increment():
    unique_metric = f"metric_{uuid.uuid4().hex[:6]}"

    # 1. Decision = approve should not increment
    count0 = record_metric_decision(unique_metric, "approve")
    assert count0 == 0

    # 2. Decision = correct should increment
    count1 = record_metric_decision(unique_metric, "correct")
    assert count1 == 1

    # 3. Decision = reject should increment
    count2 = record_metric_decision(unique_metric, "reject")
    assert count2 == 2

    # 4. Check threshold adjustment
    # Base threshold = 0.75, with 2 corrections, bar rises to 0.90 or 0.95
    eff_thresh, is_adj = get_adaptive_confidence_threshold(
        metric=unique_metric,
        base_threshold=0.75,
        threshold_limit=2,
        adjustment_penalty=0.20,
        max_threshold=0.95
    )
    assert is_adj is True
    assert eff_thresh == 0.95

    # Another metric with 0 corrections remains at base threshold
    clean_metric = f"clean_{uuid.uuid4().hex[:6]}"
    eff_clean, is_adj_clean = get_adaptive_confidence_threshold(
        metric=clean_metric,
        base_threshold=0.75,
        threshold_limit=2
    )
    assert is_adj_clean is False
    assert eff_clean == 0.75
