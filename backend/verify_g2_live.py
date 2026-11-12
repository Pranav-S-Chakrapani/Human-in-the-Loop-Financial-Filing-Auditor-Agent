import asyncio
import json
import uuid
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from backend.app.graph.build import build_pipeline_graph
from backend.app.db import init_db

async def run_live_verification():
    init_db()
    tickers = ["AAPL", "MSFT", "KO"]
    all_results = {}

    async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
        await checkpointer.setup()
        pipeline = build_pipeline_graph(checkpointer)

        for ticker in tickers:
            run_id = f"r_g2_verify_{ticker.lower()}_{uuid.uuid4().hex[:4]}"
            config = {"configurable": {"thread_id": run_id}}
            initial_state = {
                "run_id": run_id,
                "ticker": ticker,
                "company": f"{ticker} Inc."
            }
            res = await pipeline.ainvoke(initial_state, config)
            all_results[ticker] = res

    # Print formatted verification tables
    print("\n" + "="*115)
    print("GATE 2 LIVE EXTRACTION, SCORING, VALIDATION & TRIAGE VERIFICATION (AAPL, MSFT, KO)")
    print("="*115)

    for ticker, res in all_results.items():
        print(f"\n>>> TICKER: {ticker}")
        header = f"{'Metric':<22} | {'Value A (Rules)':<16} | {'Value B (LLM)':<16} | {'Confidence':<10} | {'Method':<10} | {'Status':<15} | {'Validations':<20}"
        print(header)
        print("-" * len(header))

        scored = res.get("scored_metrics", {})
        validations = res.get("validations", [])

        # map validations to metric
        val_status_map = {}
        for v in validations:
            m = v.get("metric", "")
            val_status_map.setdefault(m, []).append(f"{v.get('check_type')}:{v.get('status')}")

        for m_name, m in scored.items():
            va = str(m.get("value_a")) if m.get("value_a") is not None else "null"
            vb = str(m.get("value_b")) if m.get("value_b") is not None else "null"
            conf = f"{m.get('confidence', 0.0):.2f}"
            method = m.get("method", "unknown")
            status = m.get("decision_status", "unknown")
            val_str = ", ".join(val_status_map.get(m_name, [])) or "none"

            print(f"{m_name:<22} | {va:<16} | {vb:<16} | {conf:<10} | {method:<10} | {status:<15} | {val_str:<20}")

if __name__ == "__main__":
    asyncio.run(run_live_verification())
