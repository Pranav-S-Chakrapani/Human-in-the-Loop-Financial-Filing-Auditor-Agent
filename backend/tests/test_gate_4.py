import pytest
import sqlite3
import json
from backend.app.api.report import compute_report_metrics

def test_confusion_matrix_and_calibration_math():
    """
    Test confusion matrix & calibration calculation using synthetic database rows.
    Verifies:
    - approved_correct, approved_wrong, escalated_wrong, escalated_correct
    - lenient and strict escalation precision
    - calibration bucket aggregation
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Create minimal schema
    cur.executescript("""
        CREATE TABLE runs (run_id TEXT PRIMARY KEY, ticker TEXT, status TEXT);
        CREATE TABLE metrics (
            metric_id TEXT PRIMARY KEY, run_id TEXT, metric TEXT, is_current INTEGER,
            decision_status TEXT, scale INTEGER, value_dollars REAL, confidence REAL,
            fault_injected INTEGER, ground_truth TEXT
        );
        CREATE TABLE audit_log (seq INTEGER PRIMARY KEY, review_id TEXT, row_hash TEXT, prev_hash TEXT);
    """)

    # Populate runs
    cur.execute("INSERT INTO runs VALUES ('r1', 'AAPL', 'completed'), ('r2', 'MSFT', 'completed');")

    # 1. approved_correct: auto_approved or approved with correct=True
    gt_correct = json.dumps({"value": 1000.0, "correct": True})
    cur.execute("""
        INSERT INTO metrics VALUES ('m1', 'r1', 'revenue', 1, 'auto_approved', 1000000, 1000.0, 0.95, 0, ?)
    """, (gt_correct,))
    cur.execute("""
        INSERT INTO metrics VALUES ('m2', 'r1', 'net_income', 1, 'approved', 1000000, 1000.0, 0.85, 0, ?)
    """, (gt_correct,))

    # 2. approved_wrong: auto_approved with correct=False
    gt_wrong = json.dumps({"value": 1000.0, "correct": False})
    cur.execute("""
        INSERT INTO metrics VALUES ('m3', 'r1', 'total_assets', 1, 'auto_approved', 1000000, 500.0, 0.92, 0, ?)
    """, (gt_wrong,))

    # 3. escalated_wrong: escalated and initially wrong (needed human review!)
    cur.execute("""
        INSERT INTO metrics VALUES ('m4', 'r2', 'revenue', 1, 'corrected', 1000000, 300.0, 0.40, 1, ?)
    """, (gt_correct,)) # initially 300 vs gt 1000 -> escalated_wrong

    # 4. escalated_correct: escalated but initially correct (false alarm)
    cur.execute("""
        INSERT INTO metrics VALUES ('m5', 'r2', 'net_income', 1, 'pending_review', 1000000, 1000.0, 0.40, 0, ?)
    """, (gt_correct,)) # initially 1000 == gt 1000 -> escalated_correct

    conn.commit()

    report = compute_report_metrics(conn)

    confusion = report["confusion"]
    assert confusion["approved_correct"] == 2
    assert confusion["approved_wrong"] == 1
    assert confusion["escalated_wrong"] == 1
    assert confusion["escalated_correct"] == 1

    # Escalation precision:
    # strict = escalated_wrong / (escalated_wrong + escalated_correct) = 1 / 2 = 0.5
    assert report["escalation_precision"]["strict"] == 0.50

    # Calibration buckets:
    # 0.9-1.0: m1 (0.95, correct), m3 (0.92, wrong) -> n=2, acc = 1/2 = 0.5
    calib = {b["bucket"]: b for b in report["calibration"]}
    assert "0.9-1.0" in calib
    assert calib["0.9-1.0"]["n"] == 2
    assert calib["0.9-1.0"]["accuracy"] == 0.5

    # 0.8-0.9: m2 (0.85, correct) -> n=1, acc=1.0
    assert "0.8-0.9" in calib
    assert calib["0.8-0.9"]["n"] == 1
    assert calib["0.8-0.9"]["accuracy"] == 1.0

    conn.close()
