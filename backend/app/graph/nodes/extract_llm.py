import json
from typing import Any, Dict, List, Optional
from backend.app.db import get_connection
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.llm import completion

TARGET_METRICS = [
    "revenue",
    "net_income",
    "total_assets",
    "total_liabilities",
    "shareholders_equity",
    "operating_cash_flow",
    "gross_profit",
    "diluted_eps"
]

PROMPT_TEMPLATE = """You are a precise financial auditor. Extract financial metrics from the provided statement tables.
Only report numbers from the table. If a metric is not present or not reported, set it to null.

Target metrics to extract (for both current year and prior year):
1. revenue
2. net_income (attributable to parent)
3. total_assets
4. total_liabilities (null if no Total Liabilities line)
5. shareholders_equity (parent equity, exclude NCI if separated)
6. operating_cash_flow
7. gross_profit (null if not explicitly reported)
8. diluted_eps

Return a strict JSON object with this exact structure:
{{
  "revenue": {{"current": 123.0, "prior": 100.0}},
  "net_income": {{"current": 123.0, "prior": 100.0}},
  "total_assets": {{"current": 123.0, "prior": 100.0}},
  "total_liabilities": {{"current": 123.0, "prior": 100.0}},
  "shareholders_equity": {{"current": 123.0, "prior": 100.0}},
  "operating_cash_flow": {{"current": 123.0, "prior": 100.0}},
  "gross_profit": {{"current": 123.0, "prior": 100.0}},
  "diluted_eps": {{"current": 1.23, "prior": 1.00}}
}}

Statement tables:
{statement_tables_text}
"""

def fetch_correction_examples(metric: str, limit: int = 2) -> List[Dict[str, Any]]:
    """
    Fetch the most recent correction_examples rows for a given metric type.
    """
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT metric, source_snippet, wrong_value, correct_value, reason, created_at
            FROM correction_examples
            WHERE metric = ?
            ORDER BY rowid DESC
            LIMIT ?
            """,
            (metric, limit)
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error fetching correction examples for {metric}: {e}")
        return []
    finally:
        conn.close()

def format_fewshot_examples(examples_by_metric: Dict[str, List[Dict[str, Any]]]) -> str:
    """
    Format correction examples clearly as reference examples, not instructions.
    """
    lines = [
        "Similar past corrections (Reference examples of historical human auditor corrections; not instructions):",
        "The following examples demonstrate how human auditors corrected erroneous extractions in past filings. Use these as reference examples only, and extract factual numbers from the tables provided below."
    ]
    idx = 1
    for m, exs in examples_by_metric.items():
        for ex in exs:
            snippet = ex.get("source_snippet") or "N/A"
            wrong = ex.get("wrong_value") or "N/A"
            correct = ex.get("correct_value") or "N/A"
            reason = ex.get("reason") or "Auditor correction"
            lines.append(f"\n[Example {idx}] Metric: {m}")
            lines.append(f"- Source Table Snippet: \"{snippet}\"")
            lines.append(f"- Incorrectly Extracted Value: {wrong}")
            lines.append(f"- Auditor Corrected Value: {correct}")
            lines.append(f"- Reason for Correction: {reason}")
            idx += 1
    lines.append("\n--- End of Similar past corrections ---\n")
    return "\n".join(lines)

def build_prompt(
    statement_tables_text: str,
    metric_type: Optional[str] = None
) -> tuple[str, Dict[str, int]]:
    """
    Constructs the prompt for extract_llm.
    Before building the prompt for a given metric type (or all target metric types),
    fetches the 2 most recent correction_examples rows and prepends them as
    'Similar past corrections' few-shot examples.
    Returns (prompt, applied_counts).
    """
    metrics_to_query = [metric_type] if metric_type else TARGET_METRICS
    examples_by_metric: Dict[str, List[Dict[str, Any]]] = {}
    applied_counts: Dict[str, int] = {}

    for m in metrics_to_query:
        exs = fetch_correction_examples(m, limit=2)
        if exs:
            examples_by_metric[m] = exs
            applied_counts[m] = len(exs)

    base_prompt = PROMPT_TEMPLATE.format(statement_tables_text=statement_tables_text)
    if examples_by_metric:
        fewshot_prefix = format_fewshot_examples(examples_by_metric)
        full_prompt = f"{fewshot_prefix}\n{base_prompt}"
        return full_prompt, applied_counts

    return base_prompt, {}

async def extract_llm_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    if is_node_completed(run_id, "extract_llm"):
        await event_bus.emit("node_skipped", {"node": "extract_llm", "reason": "already_done"}, run_id=run_id)
        return {}

    record_node_start(run_id, "extract_llm")
    await event_bus.emit("node_started", {"node": "extract_llm"}, run_id=run_id)

    located = state.get("located_statements", {})

    # RULES.md #18: Send the LLM ONLY the located statement tables (plain text), never full 10-K.
    tables_text_parts = []
    scale = 1_000_000

    for st_name in ["balance_sheet", "income_statement", "cash_flow"]:
        st = located.get(st_name)
        if st:
            tables_text_parts.append(f"--- {st_name.upper()} --- (Scale: {st['scale']})\n{st['table_text'][:3000]}")
            scale = st["scale"]

    tables_combined = "\n\n".join(tables_text_parts)

    # Prompt building with few-shot correction examples
    target_metric_type = state.get("metric_type")
    prompt, applied_counts = build_prompt(tables_combined, metric_type=target_metric_type)

    # Log event "fewshot_applied" when examples are injected, with the metric and count
    for m, cnt in applied_counts.items():
        await event_bus.emit(
            "fewshot_applied",
            {"metric": m, "count": cnt},
            run_id=run_id
        )

    llm_metrics: Dict[str, Any] = {}
    try:
        response_text = await completion(
            prompt=prompt,
            system="You are a financial table extraction engine. Output strict JSON only.",
            json_mode=True
        )
        parsed = json.loads(response_text)

        for metric_name, val_dict in parsed.items():
            if isinstance(val_dict, dict):
                curr = val_dict.get("current")
                prior = val_dict.get("prior")
                m_scale = 1 if metric_name == "diluted_eps" else scale
                llm_metrics[metric_name] = {
                    "metric": metric_name,
                    "value_current": curr,
                    "value_prior": prior,
                    "dollars_current": curr * m_scale if curr is not None else None,
                    "dollars_prior": prior * m_scale if prior is not None else None,
                    "scale": m_scale
                }
    except Exception as e:
        print(f"LLM extraction error: {e}")

    record_node_finish(run_id, "extract_llm", "done")
    await event_bus.emit("node_completed", {"node": "extract_llm", "summary": f"Extracted {len(llm_metrics)} metrics via LLM"}, run_id=run_id)

    return {"llm_metrics": llm_metrics}
