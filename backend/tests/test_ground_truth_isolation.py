import os
import re
from pathlib import Path

def test_ground_truth_isolation():
    """
    RULES.md #1 & EVAL Task 5:
    Ground truth is isolated. XBRL Company Facts is imported only in groundtruth.py,
    called only from verify.py and report.py. No extraction, scoring, validation or
    triage code may import it.
    This test greps the import graph and fails if violated.
    """
    backend_app = Path("backend/app")
    assert backend_app.exists(), "backend/app does not exist"

    # Permitted modules to import groundtruth
    permitted_importers = {
        Path("backend/app/graph/nodes/verify.py").resolve(),
        Path("backend/app/api/report.py").resolve(),
        Path("backend/app/graph/nodes/report.py").resolve(),
        Path("backend/app/groundtruth.py").resolve()
    }

    violations = []

    # Check all python files in backend/app
    for py_file in backend_app.rglob("*.py"):
        resolved = py_file.resolve()
        content = py_file.read_text(encoding="utf-8")

        # Check for imports of groundtruth or companyfacts
        has_gt_import = bool(re.search(r"^\s*(from|import)\s+.*groundtruth", content, re.MULTILINE))
        has_cf_mention = "companyfacts" in content and resolved != Path("backend/app/groundtruth.py").resolve()

        if has_gt_import:
            if resolved not in permitted_importers:
                violations.append(f"{py_file}: imports groundtruth but is not in permitted set {permitted_importers}")

        if has_cf_mention:
            if resolved not in permitted_importers:
                violations.append(f"{py_file}: references companyfacts directly (XBRL isolation violated)")

    assert len(violations) == 0, f"Ground truth isolation violated:\n" + "\n".join(violations)
