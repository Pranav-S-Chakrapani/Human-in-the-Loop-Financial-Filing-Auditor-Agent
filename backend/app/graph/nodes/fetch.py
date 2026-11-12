import json
from pathlib import Path
from typing import Any, Dict, Optional
from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.edgar import fetch_edgar

COMPANIES_FILE = Path("companies.json")

def load_pinned_company(ticker: str) -> Optional[Dict[str, Any]]:
    if not COMPANIES_FILE.exists():
        return None
    with open(COMPANIES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        for c in data:
            if c["ticker"].upper() == ticker.upper():
                return c
    return None

async def fetch_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    ticker = state.get("ticker", "AAPL")

    # RULES.md #8: Node idempotency check
    if is_node_completed(run_id, "fetch"):
        await event_bus.emit("node_skipped", {"node": "fetch", "reason": "already_done"}, run_id=run_id)
        return {}

    record_node_start(run_id, "fetch")
    await event_bus.emit("node_started", {"node": "fetch"}, run_id=run_id)

    comp = load_pinned_company(ticker)
    if not comp:
        raise ValueError(f"Company {ticker} not found in companies.json")

    cik = comp["cik"]
    cik_no_zero = str(int(cik))
    accn = comp["accession"]
    accn_no_dash = accn.replace("-", "")
    primary_doc = comp["primary_document"]

    # Check fixture cache first (offline-capable per RULES #17)
    fixture_dir = Path(comp.get("fixture_path", f"data/fixtures/{ticker}"))
    html_fixture = fixture_dir / "10k.html"
    subm_fixture = fixture_dir / "submissions.json"

    if html_fixture.exists():
        doc_html_path = str(html_fixture.resolve())
    else:
        doc_url = f"https://www.sec.gov/Archives/edgar/data/{cik_no_zero}/{accn_no_dash}/{primary_doc}"
        status, html_content = await fetch_edgar(doc_url)
        if status != 200:
            raise RuntimeError(f"Failed to fetch 10-K from EDGAR: status {status}")
        # Save to disk
        fixture_dir.mkdir(parents=True, exist_ok=True)
        html_fixture.write_text(html_content, encoding="utf-8")
        doc_html_path = str(html_fixture.resolve())

    record_node_finish(run_id, "fetch", "done")
    await event_bus.emit("node_completed", {"node": "fetch", "summary": f"Fetched {ticker} 10-K"}, run_id=run_id)

    return {
        "cik": cik,
        "accession": accn,
        "fiscal_year": int(comp["report_date"][:4]),
        "doc_html_path": doc_html_path
    }
