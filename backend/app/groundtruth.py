"""
groundtruth.py — Ground truth loader isolated strictly to verify and report nodes.
RULES.md #1: XBRL Company Facts is imported ONLY in groundtruth.py, called ONLY from verify.py and report.py.
No extraction, scoring, validation or triage code may import this module.
"""

import json
from pathlib import Path
from typing import Any, Dict, Optional

FIXTURES_DIR = Path("data/fixtures")

def load_ground_truth(ticker: str) -> Dict[str, Any]:
    """Loads the pre-computed ground truth map or direct facts for a ticker."""
    gt_map_file = FIXTURES_DIR / "groundtruth_map.json"
    if gt_map_file.exists():
        with open(gt_map_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            if ticker in data:
                return data[ticker]

    facts_path = FIXTURES_DIR / ticker / "companyfacts.json"
    if facts_path.exists():
        with open(facts_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}
