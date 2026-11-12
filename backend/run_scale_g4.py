import asyncio
import json
import uuid
from typing import Any, Dict, List
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.types import Command
from backend.app.db import init_db, get_connection
from backend.app.graph.build import build_pipeline_graph
from backend.app.api.report import compute_report_metrics
from backend.app.config import get_config
from backend.app.audit import append_audit_entry

SEMAPHORE_LIMIT = 3  # bounded concurrency from config.yaml llm.concurrency

async def run_company_pipeline(
    ticker: str,
    pipeline: Any,
    sem: asyncio.Semaphore
) -> Dict[str, Any]:
    async with sem:
        run_id = f"r_scale_{ticker.lower()}_{uuid.uuid4().hex[:4]}"
        config = {"configurable": {"thread_id": run_id}}
        initial_state = {
            "run_id": run_id,
            "ticker": ticker,
            "company": f"{ticker} Inc."
        }

        # Initialize run in db
        conn = get_connection()
        conn.execute(
            """
            INSERT INTO runs (run_id, ticker, company, cik, accession, fiscal_year, status, current_node, created_at, updated_at)
            VALUES (?, ?, ?, '0000000000', '0000000000-00-000000', 2026, 'running', 'fetch', 'now', 'now')
            """,
            (run_id, ticker, f"{ticker} Inc.")
        )
        conn.commit()
        conn.close()

        print(f"[{ticker}] Starting pipeline...")
        try:
            await pipeline.ainvoke(initial_state, config)

            # Auto-handle any pending human reviews for this scale verification run
            max_reviews = 10
            while max_reviews > 0:
                st = await pipeline.aget_state(config)
                if not st.next:
                    break
                if st.next[0] == "human_review":
                    conn = get_connection()
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT review_id, metric_id FROM reviews WHERE run_id = ? AND status = 'pending' ORDER BY rowid ASC LIMIT 1",
                        (run_id,)
                    )
                    rev = cur.fetchone()
                    conn.close()

                    if rev:
                        r_id = rev["review_id"]
                        m_id = rev["metric_id"]
                        # Auto-approve in scale runner
                        append_audit_entry(
                            review_id=r_id,
                            run_id=run_id,
                            company=f"{ticker} Inc.",
                            metric=m_id.replace(f"m_{run_id}_", ""),
                            period="FY2026",
                            original_value=None,
                            corrected_value=None,
                            decision="approve",
                            reviewer="scale_runner",
                            note="scale auto-decision",
                            reasons=[],
                            confidence=0.7
                        )
                        conn = get_connection()
                        conn.execute("UPDATE reviews SET status = 'approve' WHERE review_id = ?", (r_id,))
                        conn.commit()
                        conn.close()

                        await pipeline.ainvoke(Command(resume={"decision": "approve", "corrected_value": None, "note": "ok", "reviewer": "scale_runner"}), config)
                max_reviews -= 1

            # Mark run as completed in db
            conn = get_connection()
            conn.execute("UPDATE runs SET status = 'completed', updated_at = 'now' WHERE run_id = ?", (run_id,))
            conn.commit()
            conn.close()
            print(f"[{ticker}] Completed successfully.")
            return {"ticker": ticker, "status": "completed", "run_id": run_id}

        except Exception as e:
            print(f"[{ticker}] Failed: {e}")
            conn = get_connection()
            conn.execute("UPDATE runs SET status = 'failed', updated_at = 'now' WHERE run_id = ?", (run_id,))
            conn.commit()
            conn.close()
            return {"ticker": ticker, "status": "failed", "error": str(e), "run_id": run_id}

async def main():
    init_db()
    with open("companies.json", "r", encoding="utf-8") as f:
        comps = json.load(f)

    tickers = [c["ticker"] for c in comps]
    print(f"Running Goal G4 Scale on {len(tickers)} companies: {tickers}")

    sem = asyncio.Semaphore(SEMAPHORE_LIMIT)

    async with AsyncSqliteSaver.from_conn_string("checkpoints.db") as checkpointer:
        await checkpointer.setup()
        pipeline = build_pipeline_graph(checkpointer)

        tasks = [run_company_pipeline(t, pipeline, sem) for t in tickers]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    print("\n--- Pipeline Execution Summary ---")
    for r in results:
        print(r)

    # Compute and display report
    conn = get_connection()
    report = compute_report_metrics(conn)
    conn.close()

    print("\n" + "="*80)
    print("FINAL GET /report METRICS")
    print("="*80)
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
