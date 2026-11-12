import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from backend.app.edgar import fetch_edgar

router = APIRouter(tags=["companies"])

LOCAL_TICKERS_FILE = Path("data/fixtures/company_tickers.json")
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"

# In-memory session store for custom added companies (isolated from pinned 8)
_CUSTOM_COMPANIES: Dict[str, Dict[str, Any]] = {}

class AddCompanyRequest(BaseModel):
    ticker: str

def get_custom_company(ticker: str) -> Optional[Dict[str, Any]]:
    return _CUSTOM_COMPANIES.get(ticker.upper())

def list_custom_companies() -> List[Dict[str, Any]]:
    return list(_CUSTOM_COMPANIES.values())

async def get_all_tickers_data() -> Dict[str, Any]:
    """Retrieve company_tickers mapping from local cache or SEC EDGAR."""
    if LOCAL_TICKERS_FILE.exists():
        try:
            with open(LOCAL_TICKERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    status, text = await fetch_edgar(SEC_TICKERS_URL)
    if status == 200:
        try:
            data = json.loads(text)
            LOCAL_TICKERS_FILE.parent.mkdir(parents=True, exist_ok=True)
            LOCAL_TICKERS_FILE.write_text(text, encoding="utf-8")
            return data
        except Exception:
            pass

    return {}

@router.get("/companies")
def get_companies_list() -> Dict[str, Any]:
    """Return both pinned and session custom companies."""
    pinned = ["AAPL", "MSFT", "NKE", "PEP", "JNJ", "KO", "AMZN", "GOOGL"]
    custom = list(_CUSTOM_COMPANIES.values())
    return {
        "pinned": pinned,
        "custom": custom
    }

@router.post("/companies")
async def add_company(req: AddCompanyRequest) -> Dict[str, Any]:
    ticker_clean = req.ticker.strip().upper()
    if not ticker_clean:
        raise HTTPException(status_code=400, detail="Ticker symbol is required.")

    # 1. Search in company_tickers.json
    tickers_dict = await get_all_tickers_data()
    found_entry: Optional[Dict[str, Any]] = None

    for item in tickers_dict.values():
        if item.get("ticker", "").upper() == ticker_clean:
            found_entry = item
            break

    if not found_entry:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker_clean}' not found in SEC company directory."
        )

    cik_raw = found_entry.get("cik_str")
    title = found_entry.get("title", f"{ticker_clean} Inc.")
    cik_str = str(cik_raw).zfill(10)

    # 2. Check for recent 10-K via SEC submissions
    subm_url = f"https://data.sec.gov/submissions/CIK{cik_str}.json"
    status, subm_text = await fetch_edgar(subm_url)

    if status != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch SEC filing directory for CIK {cik_str} (status {status})."
        )

    try:
        subm_data = json.loads(subm_text)
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Invalid JSON response from SEC filing directory."
        )

    recent = subm_data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accessions = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])
    filing_dates = recent.get("filingDate", [])
    report_dates = recent.get("reportDate", [])

    tenk_idx: Optional[int] = None
    for i, f in enumerate(forms):
        if f == "10-K":
            tenk_idx = i
            break

    if tenk_idx is None:
        raise HTTPException(
            status_code=404,
            detail=f"Company '{ticker_clean}' found ({title}, CIK {cik_str}), but no recent 10-K filing was found."
        )

    accn = accessions[tenk_idx]
    primary_doc = primary_docs[tenk_idx]
    filing_date = filing_dates[tenk_idx] if tenk_idx < len(filing_dates) else "2026-01-01"
    report_date = report_dates[tenk_idx] if tenk_idx < len(report_dates) else filing_date

    company_entry = {
        "ticker": ticker_clean,
        "name": title,
        "cik": cik_str,
        "accession": accn,
        "filing_date": filing_date,
        "report_date": report_date,
        "primary_document": primary_doc,
        "is_custom": True,
        "notes": {}
    }

    _CUSTOM_COMPANIES[ticker_clean] = company_entry

    return {
        "status": "success",
        "ticker": ticker_clean,
        "company": company_entry
    }
