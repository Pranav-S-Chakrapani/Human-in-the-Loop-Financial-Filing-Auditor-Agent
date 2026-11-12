# REHEARSAL.md — Demo Machine Checklist & Operational Guide

## OS Environment: Windows (PowerShell / CMD)

---

## 1. Pre-Flight Verification & Port Status

Before starting services, ensure ports `8000` (FastAPI backend) and `5173` (Vite frontend) are free:

```powershell
netstat -ano | findstr ":8000 :5173"
```
Or via PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 8000, 5173 -ErrorAction SilentlyContinue
```
*Current status on this machine: **Both ports 8000 and 5173 are completely free**.*

---

## 2. Step-by-Step Demo Startup Checklist

### Step A: Start the Backend (No `--reload`)
> [!IMPORTANT]
> Never run with `--reload` during the kill-resume demo; `--reload` runs a parent watcher process that masks crashes and restarts workers automatically.

From the workspace root (`c:\Users\chakr\Downloads\MINEARENA`):
```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn backend.app.api.main:app --host 0.0.0.0 --port 8000
```
Verify the server starts and binds to port 8000.

### Step B: Start the Frontend
In a separate terminal:
```powershell
cd frontend
npm run dev -- --port 5173 --host
```
Open browser at `http://localhost:5173`.

---

## 3. The Kill-Resume Demo Routine

This routine proves the durable checkpointer survives mid-run termination:

### Step 1: Trigger a Run in the UI or CLI
Start an audit run on a ticker (e.g. `POST /runs {ticker: "KO"}`).

### Step 2: Find the Running Backend Process
Find the PID listening on port 8000:
```powershell
netstat -ano | findstr :8000
```
*(Look at the rightmost column for the `<PID>`)*
Or in PowerShell:
```powershell
(Get-NetTCPConnection -LocalPort 8000).OwningProcess
```

### Step 3: Hard-Kill the Backend (`kill -9` equivalent)
Run:
```cmd
taskkill /F /PID <PID>
```
*(Verified output: `SUCCESS: The process with PID <PID> has been terminated.`)*

### Step 4: Confirm Port is Free
```powershell
netstat -ano | findstr :8000
```
Output should be completely blank.

### Step 5: Restart the Backend
Re-run the exact startup command:
```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn backend.app.api.main:app --host 0.0.0.0 --port 8000
```

### Step 6: Verify Recovery
- The startup reconciler resumes paused runs and running state from `checkpoints.db`.
- Check UI for `system_recovered` toast and verify audit chain integrity at `/audit/verify`.

---

## 4. Cache Locations & Offline Defense (Venue Wi-Fi Failure)

### Cached Data Locations
- **Filing HTML & Facts Fixtures**: `data/fixtures/<TICKER>/` (`10k.html`, `submissions.json`, `companyfacts.json`).
- **EDGAR HTTP Cache**: `app.db` -> table `http_cache` & `data/cache/edgar/`.
- **LLM Call Cache**: `app.db` -> table `llm_calls` (keyed by `sha256(model + prompt)`).

### If Venue Wi-Fi Degrades or Fails:
1. **Offline Mode**: The pipeline automatically reads pinned accessions and filings from `data/fixtures/` without touching EDGAR.
2. **Cached LLM Calls**: If queries have been pre-run or cached, `llm.py` produces 0 network calls directly from `llm_calls`.
3. **Provider Fallback**: If Groq experiences rate limits or network issues, fall back seamlessly to `gemini-3.5-flash` (`GEMINI_API_KEY`).
4. **Pre-recorded Backup Video**: Keep an MP4 screen recording of the live kill-resume and review workbench flow on desktop.

---

## 5. Scope Triage: The Backup Plan

If falling behind during the hackathon schedule, use this strict triage protocol:

### What to Cut First (Non-Essential):
1. **MCP Tool Wrappers**: Revert to native Python internal calls (stretch feature).
2. **Adaptive Confidence Thresholds**: Use pinned config thresholds from `config.yaml`.
3. **Intro Screen Parallax/Motion**: Keep UI static, dark, and dense (`tabular-nums`).
4. **Segment Revenue Validation**: Mark segment check as `skipped` cleanly rather than parsing complex multi-level segment footnote reconciliations.
5. **Active Company Count**: Reduce live demo set from 8 companies down to 5 (e.g. AAPL, MSFT, NKE, KO, AMZN).

### What Must NEVER Be Cut (Core Pitch & Contract):
1. **Kill-Resume Durability**:
   - `AsyncSqliteSaver` on `checkpoints.db`.
   - `interrupt()` as the first statement of `human_review`.
   - Reconciler resuming thread on server restart.
2. **Audit Ledger & Hash Chain**:
   - SQLite append-only triggers (`RAISE(ABORT)` on `UPDATE`/`DELETE`).
   - Hash chain integrity verification (`/audit/verify`).
3. **Ground Truth Verification & Confusion Matrix**:
   - Independent verification against `data/fixtures/<TICKER>/companyfacts.json`.
   - Calibration buckets, precision metrics, and natural vs. fault-injected split.
