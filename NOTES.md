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

---

## Gate: Frontend & Contract Verification

### Contract Mismatches & UI Assumptions Observed:
1. **Mock Mode Switching (`VITE_USE_MOCKS`)**:
   - `src/api.ts` handles seamless switching between mock fixtures (`src/mocks/index.ts`) and the live FastAPI backend on port 8000.
   - Visible "MOCK" badge is displayed in the navigation header whenever `VITE_USE_MOCKS=true`.
2. **Review Workbench Actionable State**:
   - CONTRACT.md states `actionable=true` only for the head-of-queue review of its run.
   - Non-actionable items in the queue are explicitly marked "Queued behind head" and the action buttons are disabled with explanation text.
3. **Parallax and Motion Rules**:
   - Strict adherence to RULES §G #29–30: scroll-controlled parallax is strictly isolated to the background layers of the Intro screen.
   - Magnetic button cursor-following is implemented with a ~40px radius on the Intro CTA and a constrained ~20px radius on dense workbench buttons (`Approve`, `Edit`, `Reject`).
   - `prefers-reduced-motion` is detected and respected: disabling transforms and falling back to native hover states.
4. **WebSocket & Survivability UI**:
   - `system_recovered` toast appears dynamically upon reconnection/recovery.
   - Fixed footer chip displays `"Checkpointed · last checkpoint <time>"` on all screens.
