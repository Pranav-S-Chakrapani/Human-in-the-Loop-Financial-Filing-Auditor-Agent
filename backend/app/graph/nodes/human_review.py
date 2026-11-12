import json
from pathlib import Path
from typing import Any, Dict, Optional
from langgraph.types import interrupt
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.db import get_connection

def build_review_payload(review_id: str, run_id: str, state: Dict[str, Any]) -> Dict[str, Any]:
    """Builds the JSON payload for interrupt() per CONTRACT.md /reviews/{id}."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM reviews WHERE review_id = ?", (review_id,))
        rev = cur.fetchone()
        metric_id = rev["metric_id"] if rev else ""
        reasons = json.loads(rev["reasons"]) if rev and rev["reasons"] else []

        cur.execute("SELECT * FROM metrics WHERE metric_id = ?", (metric_id,))
        m = cur.fetchone()

        cur.execute("SELECT * FROM validations WHERE run_id = ?", (run_id,))
        v_rows = cur.fetchall()
        validations = []
        for v in v_rows:
            try:
                dt = json.loads(v["detail"]) if v["detail"] else {}
            except Exception:
                dt = {}
            validations.append({
                "validation_id": v["validation_id"],
                "check_type": v["check_type"],
                "metric": v["metric_id"].replace(f"m_{run_id}_", ""),
                "status": v["status"],
                "phase": v["phase"],
                "detail": dt,
                "explanation": v["explanation"]
            })

        m_name = metric_id.replace(f"m_{run_id}_", "")
        located = state.get("located_statements", {})
        stmt_html = ""
        for st_name in ["balance_sheet", "income_statement", "cash_flow"]:
            st = located.get(st_name)
            if st:
                if st.get("table_path"):
                    p = Path(st["table_path"])
                    if p.exists():
                        with open(p, "r", encoding="utf-8", errors="ignore") as f:
                            stmt_html = f.read()
                            break
                elif st.get("table_html"):
                    stmt_html = st.get("table_html", "")
                    break

        source_ref = json.loads(m["source_ref"]) if m and m["source_ref"] else {}
        highlight = {"row": source_ref.get("row", 0), "col": source_ref.get("col", 1)}

        return {
            "review_id": review_id,
            "status": "pending",
            "actionable": True,
            "round": rev["round"] if rev else 1,
            "metric": {
                "metric_id": metric_id,
                "run_id": run_id,
                "metric": m_name,
                "value_a": m["value_a"] if m else None,
                "value_b": m["value_b"] if m else None,
                "value_dollars": m["value_dollars"] if m else None,
                "confidence": m["confidence"] if m else 0.5,
                "method": m["method"] if m else "agree",
                "decision_status": m["decision_status"] if m else "pending_review",
                "snippet_text": m["snippet_text"] if m else "",
                "snippet_html": m["snippet_html"] if m else ""
            },
            "reasons": reasons,
            "validations": [v for v in validations if v["metric"] == m_name],
            "statement_html": stmt_html,
            "highlight": highlight,
            "other_extractor": {
                "rules": m["value_a"] if m else None,
                "llm": m["value_b"] if m else None
            },
            "decision": None
        }
    finally:
        conn.close()

async def human_review_node(state: Dict[str, Any]) -> Dict[str, Any]:
    # RULES.md #6: interrupt() is the FIRST statement of its node with nothing else before it.
    # The value passed to interrupt() and returned by Command(resume=...) must be plain JSON.
    review_id = state.get("current_review_id") or ""
    run_id = state.get("run_id") or ""

    decision = interrupt(
        build_review_payload(review_id, run_id, state)
    )

    record_node_start(run_id, "human_review")
    record_node_finish(run_id, "human_review", "done")

    return {
        "human_decision": decision,
        "reviewed_id": review_id
    }
