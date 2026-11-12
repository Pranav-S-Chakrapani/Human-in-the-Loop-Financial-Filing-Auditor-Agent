import json
from typing import Any, Dict, List, Optional
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.llm import completion

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
    prompt = PROMPT_TEMPLATE.format(statement_tables_text=tables_combined)

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
