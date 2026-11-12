# NOTES.md — Engineering Assumptions & Architectural Decisions

## Gate: Scaffold

### 1. Database & Persistence Architecture
- **Schema Separation**:
  - `app.db`: Holds business tables (`runs`, `node_runs`, `metrics`, `validations`, `reviews`, `audit_log`, `events`, `llm_calls`, `http_cache`). Configured with WAL mode and append-only database triggers on `audit_log`.
  - `checkpoints.db`: Dedicated solely to LangGraph's `AsyncSqliteSaver` checkpointer per RULES #11.
- **Audit Triggers**:
  - Database triggers raise `ABORT` with message `'audit_log is append-only'`. In Python's sqlite3 driver, this surfaces as `sqlite3.IntegrityError` or `sqlite3.OperationalError` depending on execution context. Both are tested and enforced.

### 2. LLM Provider & Model Selection
- Pinned primary model to `openai/gpt-oss-120b` on Groq (tested and active). Groq's deprecated `llama-3.3-70b-versatile` is avoided.
- Bounded concurrency semaphore initialized from `config.yaml` (`llm.concurrency: 3`).
- Pinned fallback model to `gemini-3.5-flash` using the official `google-genai` SDK (`gemini-2.5-flash` is retired).
- Real network calls are counted; second calls on identical prompts are served from `llm_calls` with 0 network egress.

### 3. EDGAR Client & Rate Limiting
- Enforces polite SEC request limits: 1 request every 0.2s ($\le 5$ RPS), User-Agent header formatted with real contact info.
- Disk caching implemented in `data/cache/edgar/` alongside SQLite cache.

### 4. Ground Truth Isolation (RULES #1)
- `backend/app/groundtruth.py` is the only file with knowledge of XBRL Company Facts. No extractor, validator, or triage module imports it.

### 5. Frontend & UI
- Stack initialized with Vite, React 19, TypeScript, Tailwind CSS, Lucide icons, Framer Motion, and Recharts.
- Strict dark palette tokens (`#090d16` background, tabular numbers enabled globally via `font-variant-numeric: tabular-nums`).
- All 6 CONTRACT.md screens routed: Intro (`/`), Mission Control (`/mission`), Review Workbench (`/reviews`), Metrics Grid (`/metrics`), Audit Ledger (`/audit`), Report (`/report`).
- Mock/real API layer implemented via `VITE_USE_MOCKS` in `api.ts`.
