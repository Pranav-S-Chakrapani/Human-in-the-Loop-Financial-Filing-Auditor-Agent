# VantageAudit (PS-01 Financial Filing Auditor)

> **"A system that knows when to distrust itself, and proves it survives being killed mid-run."**

VantageAudit is an agentic financial auditor that ingests real SEC 10-K HTML filings, performs independent dual-track extraction (regex/table rules + LLM), cross-validates accounting equations (Balance Sheet Assets = Liabilities + Equity, YoY variance, segment reconciliation), routes anomalous metrics to a human review workbench with durable LangGraph checkpointing, and evaluates precision against SEC XBRL ground truth.

---

## 1. Quickstart

### Prerequisites
- Python $\ge 3.11$ (verified on 3.13)
- Node.js $\ge 20$ (verified on v25)
- Git

### Setup
1. Copy `.env.example` to `.env` and set your credentials:
   ```bash
   cp .env.example .env
   ```
   Add:
   - `GROQ_API_KEY`: Primary LLM key (`openai/gpt-oss-120b`).
   - `GEMINI_API_KEY`: Fallback LLM key (`gemini-3.5-flash`).
   - `EDGAR_USER_AGENT`: `FilingAuditor your_real_email@example.com`

2. Activate backend Python virtual environment:
   - **Windows PowerShell:** `.\backend\.venv\Scripts\Activate.ps1`
   - **macOS / Linux:** `source backend/.venv/bin/activate`

---

## 2. Running Backend & Frontend

### Start the Backend
Run from repository root:
```bash
python -m uvicorn backend.app.api.main:app --host 0.0.0.0 --port 8000
```
- API Documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`
- WebSocket events: `ws://localhost:8000/ws/events?since_seq=0`

### Start the Frontend
In a separate terminal:
```bash
cd frontend
npm run dev -- --port 5173 --host
```
- Open `http://localhost:5173` in your browser.
- Switch to mock mode by creating `frontend/.env.local` with `VITE_USE_MOCKS=true`.

---

## 3. Running Test Suite
Execute the pytest suite from root:
```bash
pytest
```
Verifies:
- Audit log triggers block `UPDATE` and `DELETE` queries (`RAISE(ABORT)`).
- SHA-256 hash chain calculation and verification.
- LLM response caching without duplicate network calls.
- EDGAR client User-Agent and rate limiting.

---

## 4. Kill-Resume Durability Routine
To test mid-run durability during demo:
1. Start an audit run (`POST /runs`).
2. Find the backend PID: `netstat -ano | findstr :8000`.
3. Kill it: `taskkill /F /PID <pid>` (Windows) or `kill -9 <pid>` (macOS/Linux).
4. Restart backend: `python -m uvicorn backend.app.api.main:app --host 0.0.0.0 --port 8000`.
5. Observe the startup reconciler seamlessly resume paused and running runs from `checkpoints.db`.
