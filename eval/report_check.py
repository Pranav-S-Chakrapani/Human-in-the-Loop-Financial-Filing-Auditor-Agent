import json
import sqlite3
import sys
from backend.app.api.report import compute_report_metrics
from backend.app.db import get_connection

def independently_recompute_metrics(conn: sqlite3.Connection):
    cur = conn.cursor()

    cur.execute("SELECT count(DISTINCT ticker) as comps FROM runs WHERE status = 'completed';")
    companies = cur.fetchone()[0] or 0

    cur.execute("SELECT count(*) FROM metrics;")
    total_values = cur.fetchone()[0] or 0

    cur.execute("SELECT count(*) FROM metrics WHERE is_current = 1;")
    curr_values = cur.fetchone()[0] or 0

    cur.execute("SELECT count(*) FROM metrics WHERE is_current = 1 AND decision_status = 'auto_approved';")
    auto_app = cur.fetchone()[0] or 0

    cur.execute("SELECT count(*) FROM metrics WHERE is_current = 1 AND decision_status IN ('pending_review', 'approved', 'corrected', 'rejected', 'unresolved');")
    escalated = cur.fetchone()[0] or 0

    cur.execute("SELECT count(*) FROM metrics WHERE is_current = 1 AND ground_truth IS NOT NULL AND decision_status != 'rejected';")
    valid_count = cur.fetchone()[0] or 0

    cur.execute("SELECT count(*) FROM metrics WHERE is_current = 1 AND ground_truth LIKE '%\"correct\": true%' AND decision_status != 'rejected';")
    correct_count = cur.fetchone()[0] or 0

    raw_acc = round(correct_count / valid_count, 3) if valid_count > 0 else 0.0

    return {
        "companies": companies,
        "total_values": total_values,
        "curr_values": curr_values,
        "auto_approved": auto_app,
        "escalated": escalated,
        "raw_accuracy": raw_acc
    }

def main():
    conn = get_connection()
    try:
        report = compute_report_metrics(conn)
        independent = independently_recompute_metrics(conn)

        print("=== EVAL REPORT CHECK ===")
        print(f"Companies: independent={independent['companies']} vs report={report['totals']['companies']}")
        print(f"Total values: independent={independent['total_values']} vs report={report['totals']['values']}")
        print(f"Current values: independent={independent['curr_values']} vs report={report['totals']['current_year_values']}")
        print(f"Auto approved: independent={independent['auto_approved']} vs report={report['totals']['auto_approved']}")
        print(f"Escalated: independent={independent['escalated']} vs report={report['totals']['escalated']}")
        print(f"Raw accuracy: independent={independent['raw_accuracy']} vs report={report['accuracy']['raw']}")

        assert independent['companies'] == report['totals']['companies'], "Mismatch on companies count"
        assert independent['total_values'] == report['totals']['values'], "Mismatch on total values"
        assert independent['curr_values'] == report['totals']['current_year_values'], "Mismatch on current year values"
        assert independent['auto_approved'] == report['totals']['auto_approved'], "Mismatch on auto approved"
        assert independent['escalated'] == report['totals']['escalated'], "Mismatch on escalated count"
        assert independent['raw_accuracy'] == report['accuracy']['raw'], "Mismatch on raw accuracy"

        print("\nAll independent report checks PASSED successfully.")

    finally:
        conn.close()

if __name__ == "__main__":
    main()
