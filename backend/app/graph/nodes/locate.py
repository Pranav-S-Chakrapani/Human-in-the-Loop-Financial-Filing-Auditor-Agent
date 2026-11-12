import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup
import warnings
from bs4 import XMLParsedAsHTMLWarning
warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

from backend.app.graph.idempotency import is_node_completed, record_node_start, record_node_finish
from backend.app.events import event_bus
from backend.app.graph.nodes.parser_utils import detect_scale_multiplier

def clean_txt(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def locate_statements_in_html(html_path: str, accession: str, cik: str) -> Dict[str, Any]:
    """
    Parses visual 10-K HTML to locate Balance Sheet, Income Statement, and Cash Flow statement tables.
    RULES.md #2: Never read ix:* tags, name=, or contextRef. Visual document only.
    Filters out TOC (Table of Contents) hits.
    """
    with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()

    soup = BeautifulSoup(html, "lxml")
    tables = soup.find_all("table")

    cik_no_zero = str(int(cik))
    accn_no_dash = accession.replace("-", "")
    edgar_base_url = f"https://www.sec.gov/Archives/edgar/data/{cik_no_zero}/{accn_no_dash}/"

    located = {
        "balance_sheet": None,
        "income_statement": None,
        "cash_flow": None
    }

    for idx, tbl in enumerate(tables):
        txt = clean_txt(tbl.get_text(" ", strip=True))
        t_low = txt.lower()

        # Skip Table of Contents hits
        if len(txt) < 300 or "item 1." in t_low or "item 8." in t_low or "page" in t_low[:50]:
            # If it's a TOC row table, skip
            if "financial statements and supplementary data" in t_low and len(txt) < 1500:
                continue

        # Balance Sheet criteria
        if not located["balance_sheet"]:
            if ("cash and cash equivalents" in t_low or "cash and cash" in t_low) and \
               ("total assets" in t_low or "assets" in t_low) and \
               ("total liabilities and" in t_low or "liabilities and stockholders" in t_low or "liabilities and shareholders" in t_low or "liabilities and equity" in t_low):
                if len(txt) < 15000:
                    scale = detect_scale_multiplier(txt)
                    located["balance_sheet"] = {
                        "table_id": f"bs_table_{idx}",
                        "scale": scale,
                        "table_html": str(tbl),
                        "table_text": txt,
                        "edgar_url": edgar_base_url
                    }

        # Income Statement criteria
        if not located["income_statement"]:
            if ("net income" in t_low or "net earnings" in t_low) and ("diluted" in t_low) and \
               ("revenue" in t_low or "net sales" in t_low or "total revenues" in t_low or "sales to customers" in t_low) and \
               ("operating income" in t_low or "operating profit" in t_low or "cost of sales" in t_low or "costs and expenses" in t_low or "gross margin" in t_low or "gross profit" in t_low):
                if len(txt) < 10000 and "three months" not in t_low[:300]:
                    scale = detect_scale_multiplier(txt)
                    located["income_statement"] = {
                        "table_id": f"is_table_{idx}",
                        "scale": scale,
                        "table_html": str(tbl),
                        "table_text": txt,
                        "edgar_url": edgar_base_url
                    }

        # Cash Flow criteria
        if not located["cash_flow"]:
            if ("operating activities" in t_low or "cash provided (used) by operations" in t_low or "operations" in t_low or "operating" in t_low) and \
               ("investing" in t_low) and ("financing" in t_low):
                if len(txt) < 12000 and "supplemental" not in t_low[:150]:
                    scale = detect_scale_multiplier(txt)
                    located["cash_flow"] = {
                        "table_id": f"cf_table_{idx}",
                        "scale": scale,
                        "table_html": str(tbl),
                        "table_text": txt,
                        "edgar_url": edgar_base_url
                    }

    return located

async def locate_node(state: Dict[str, Any]) -> Dict[str, Any]:
    run_id = state.get("run_id", "")
    if is_node_completed(run_id, "locate"):
        await event_bus.emit("node_skipped", {"node": "locate", "reason": "already_done"}, run_id=run_id)
        return {}

    record_node_start(run_id, "locate")
    await event_bus.emit("node_started", {"node": "locate"}, run_id=run_id)

    html_path = state.get("doc_html_path", "")
    accession = state.get("accession", "")
    cik = state.get("cik", "")

    located = locate_statements_in_html(html_path, accession, cik)

    record_node_finish(run_id, "locate", "done")
    await event_bus.emit(
        "node_completed",
        {"node": "locate", "summary": f"Located BS={bool(located['balance_sheet'])}, IS={bool(located['income_statement'])}, CF={bool(located['cash_flow'])}"},
        run_id=run_id
    )

    return {"located_statements": located}
