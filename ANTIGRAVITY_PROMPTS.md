# ANTIGRAVITY_PROMPTS.md — Paste-ready prompt pack + your personal playbook

## 0. Before 12:00 (prep, no project code)

- [ ] Repo created with `SPEC.md`, `CONTRACT.md`, `RULES.md`, empty `README.md`, `.gitignore` (data caches, `.env`, `*.db`).
- [ ] `.env` with `GROQ_API_KEY`, `GEMINI_API_KEY`. EDGAR User-Agent string ready (`AppName your@email.com`).
- [ ] Python 3.11+, Node 20+, Antigravity installed and signed in. Test that it can run a terminal command and browse.
- [ ] RULES.md set as workspace rules / `AGENTS.md` in repo root. (If unsure where Antigravity reads rules from, keep a copy in root AND tell every prompt to read it first.)
- [ ] Candidates (verify each yourself): Apple (CIK 320193), Microsoft (789019), Coca-Cola (21344), plus 3–5 of Nike, PepsiCo, Johnson & Johnson, Alphabet or Amazon (these two are the "messy" ones: no Total liabilities line, no Gross Profit for Amazon). Confirm CIKs in `https://www.sec.gov/files/company_tickers.json`.
- [ ] For each: open the latest 10-K balance sheet and note (a) has "Total liabilities" row? (b) NCI row? (c) has Gross Profit? Write results into `companies.json` notes at 12:00 with the pinned accession numbers.

## 1. How to run the build with Antigravity

1. Open the repo as the workspace. Start **one** agent with Prompt 1 (scaffold). Wait for it (~20 min). Review the diff yourself.
2. Then run **three agents in parallel** (Manager view): BACKEND (Prompt 2), FRONTEND (Prompt 3), EVAL (Prompt 4). They own disjoint folders. Never let two edit the same files.
3. At every gate: you run the gate command yourself, tag git, then give the next prompt.
4. **You personally review**: `human_review.py`, `audit.py` + triggers, `groundtruth.py` isolation, `llm.py` cache. Everything else you spot-check by running it.
5. If an agent goes in circles for > 15 minutes, stop it, read its notes, and give a narrower prompt.

---

## Prompt 1 — Scaffold (single agent, ~20 min)

```
You are building PS-01 "Human-in-the-Loop Financial Filing Auditor" for a 24-hour hackathon.
First read, in order: RULES.md, SPEC.md, CONTRACT.md. They are binding.

Task: create the project skeleton ONLY, no business logic yet.
1. /backend with the exact layout in SPEC.md §4, FastAPI app that boots, `/health` returning the contract shape.
2. db.py with the full schema and audit triggers from SPEC.md §6; run on startup; WAL mode.
3. config.py + config.yaml from SPEC.md §14 with GET/PUT /config.
4. events.py: event bus that persists to `events` and fans out to WS /ws/events with `since_seq` replay (CONTRACT.md).
5. llm.py: Groq client with the llm_calls cache (RULES.md #9), concurrency semaphore, counters, Gemini fallback stub.
6. edgar.py: httpx client with User-Agent from config, rate limiter, retry/backoff, disk cache in /data (RULES.md #17).
7. Pydantic models for every object in CONTRACT.md in backend/app/models.py.
8. /frontend: Vite + React + TS + Tailwind + shadcn/ui + framer-motion + @xyflow/react + recharts installed, router with 6 empty screens, api.ts with mock/real switch, dark theme tokens.
9. pytest with tests: audit triggers block UPDATE/DELETE; hash chain verify; llm cache returns without network on 2nd call; edgar client sends User-Agent.
10. README with run instructions.
Do not implement graph nodes. Commit as "scaffold". Write assumptions to NOTES.md.
```

**Check yourself:** `pytest` green, `uvicorn app.main:app` boots, `npm run dev` boots. Tag nothing yet.

---

## Prompt 2 — BACKEND agent (long-running, in stages)

### Stage G1 — Spine (the riskiest thing first)

```
Role: BACKEND agent. Own /backend only. Read RULES.md, SPEC.md §7 §10, CONTRACT.md.

Goal G1: prove interrupt → kill -9 → resume on a TOY graph, then wire the real EDGAR fetch.
1. Build graph/build.py with AsyncSqliteSaver on checkpoints.db (separate from app.db) created in FastAPI lifespan.
2. Create a toy graph: step_a (writes a row, increments a counter) → human_review (interrupt, first statement) → step_b (writes a row). Expose it via POST /runs with company "TOY".
3. Implement POST /reviews/{id}/decision per SPEC §10 (durable-first: audit row + review status in one txn, THEN Command(resume=...)).
4. Implement the startup reconciler: resume `running` runs with ainvoke(None, config); for `paused` runs whose head review is already decided, resume with the stored decision; emit `system_recovered`.
5. Implement audit.py (hash chain, BEGIN IMMEDIATE, UNIQUE review_id) + /audit + /audit/verify + /admin/tamper.
6. Implement node_runs idempotency helper used by every node.
7. Real fetch node: AAPL ticker → submissions API → pinned accession from companies.json → cached primary doc.
Tests (must pass): resume after simulated process restart does not re-run step_a; duplicate POST decision returns duplicate:true with exactly one audit row; tamper endpoint reports both blocked.
Commit. Report what you ran and the output.
```

**Gate G1 (you run it):** start server → `POST /runs` TOY → paused → `kill -9` → restart → `POST decision` → completes; counters unchanged. Tag `g1-spine`.

### Stage G2 — Extraction + validation

```
Role: BACKEND agent. Goal G2 per SPEC.md §5 §8 §9 §11 and RULES.md A, E.
Implement nodes: locate, extract_rules, extract_llm (parallel branches joining at score), score, validate, triage.
- Parse the 10-K HTML visually (RULES #2). Locate balance/income/cash tables, scale, period columns; skip table-of-contents hits.
- 8 metrics x current+prior year. Store value_a, value_b, snippet_text, snippet_html (just the <tr>), source_ref with table/row/col, and an EDGAR URL.
- Rules extractor with synonym lists; LLM extractor sends only located tables, strict JSON, temp 0.
- Scoring with configurable weights and disagree_cap; breakdown JSON stored.
- Validation: equation (with NCI handling, derived total liabilities), YoY (per-metric overrides, LLM one-line explanation, cached), segment (skip gracefully), cross-statement.
- Triage emits typed reasons (SPEC §10). Prior-year values are never escalated; they feed YoY and the stats.
- Fault injection module + POST /admin/inject-fault (SPEC §12).
Create tests/fixtures with the cached AAPL and MSFT filings and unit tests for: number normalization, scale handling, label synonyms, equation with NCI, derived liabilities, YoY threshold, segment skip.
Run on AAPL, MSFT, KO and print a table: metric, A, B, confidence, method, status, validation results. Do NOT import groundtruth.py. Commit and report.
```

**Gate G2:** one company, 8 metrics, confidence + validations stored. You eyeball the printed table against the real statements for at least 3 numbers. Tag `g2-extract`.

### Stage G3 — Real review loop

```
Role: BACKEND agent. Goal G3 per SPEC §10 and CONTRACT.md (Reviews, WS).
Replace the toy graph with the real graph: ... triage → enqueue_reviews → human_review loop → apply_decisions → revalidate → ground_truth_verify → report.
- enqueue_reviews idempotently creates reviews (UNIQUE run_id+metric_id+round), sets review_queue, routes.
- human_review: ONLY interrupt in the project; first statement; payload per CONTRACT (value, confidence+breakdown, snippet, reasons, other extractor values, EDGAR URL, statement_html with highlight coords).
- Endpoints: GET /reviews, GET /reviews/{id} (actionable = head-of-queue only), POST decision (approve/correct/reject semantics in SPEC §10), GET /runs, GET /runs/{id}.
- Revalidate after corrections; max 2 rounds; reject → null/unresolved.
- Emit every event type in CONTRACT.md.
- groundtruth.py + verify node (the only XBRL consumer): match on form=10-K, accession, period end, duration span; tolerance 0.5*scale.
Tests: full run on a fault-injected company pauses, correct decision flows into final_value, audit row exists, rerun produces zero new LLM network calls.
Commit and report.
```

**Gate G3:** one company runs live end to end in the browser or with curl. Tag `g3-live`.

### Stage G4 — Scale + report

```
Role: BACKEND agent. Goal G4. Implement GET /report exactly per CONTRACT.md and SPEC §13: raw/auto-approved/post-review accuracy, counts, confusion matrix, escalation precision (lenient + strict), calibration buckets, reliability counters, natural vs injected split. All numbers computed from DB rows only.
Run all companies in companies.json with bounded concurrency. Add robustness for parsing failures per company (log, mark failed, continue). Add per-company fixes only via general rules, never hard-coded answers.
Write tests for confusion-matrix and calibration math with synthetic rows.
Commit and report the real numbers, including the worst-performing metric and why.
```

**Gate G4:** ≥5 companies (target 8), report real. Tag `g4-scale`.

---

## Prompt 3 — FRONTEND agent

```
Role: FRONTEND agent. Own /frontend only. Read RULES.md (esp. F, G), SPEC.md §15, CONTRACT.md.

Build against mocks first: create /frontend/src/mocks with fixtures for every endpoint in CONTRACT.md (3+ companies, 6+ pending reviews covering all reason codes, 8+ audit rows with a valid-looking chain, full report) and a scripted mock event emitter (one pause, one resume, one system_recovered). VITE_USE_MOCKS=true switches api.ts; no component may know the difference. Show a visible "MOCK" badge in mock mode.

Screens (dark, dense, tabular numerals, one accent, semantic amber/red/green):
1. Intro: 10-15s skippable parallax story (problem → approach → Enter). Only place for parallax.
2. Mission Control: @xyflow/react canvas, a lane per company, nodes per graph step, live state from WebSocket (idle / running pulse / done / amber interrupt / red failed), minimap, click amber node → opens that review, side event feed, live counters (LLM calls, audit rows, escalations), "Start run" panel with company picker + fault-mode dropdown.
3. Review Workbench: queue left (pending/completed tabs, reason chips), center = statement_html with highlighted cell + "Open on EDGAR", right = value, confidence ring with breakdown on hover, typed reasons, YoY explanation, both extractor values, validations passed/failed; Approve / Edit / Reject with keys A / E / R; edit inline; strike-through original → highlighted correction animation; queued-behind items disabled with explanation.
4. Metrics grid: company × metric heatmap by confidence + status, click → evidence drawer.
5. Audit Ledger: rows with hash chain visual, Verify integrity button, Attempt tamper button (calls /admin/tamper and shows the DB refusing).
6. Report: confusion matrix, calibration reliability chart, accuracy bars, reliability counters, natural-vs-injected split, export JSON.
Always-visible footer chip: "Checkpointed · last checkpoint <time>" and a toast on system_recovered.
Accessibility: keyboard navigable, prefers-reduced-motion respected.
When done, make `npm run build` pass and list any contract mismatches you noticed in NOTES.md. Do not edit CONTRACT.md.
```

**Gate G5-mid (around hour 8):** flip `VITE_USE_MOCKS=false` and fix mismatches.

Second frontend prompt for polish (hour 18+):
```
Polish pass: skeleton loaders, empty states, error toasts, WS reconnect with since_seq replay, 1080p and laptop layouts, keyboard shortcuts overlay (?), and a presenter mode that enlarges counters. Do not add new features. Verify the review → decision → resume flow in the real backend.
```

---

## Prompt 4 — EVAL agent

```
Role: EVAL agent. Own /eval and /backend/tests only. Read RULES.md and SPEC.md §10 §13.

1. eval/kill_resume_test.py: spawns the server as a subprocess WITHOUT --reload; starts a run on a fault-injected ticker; waits for `paused`; records counters (llm unique calls, audit rows, events); `kill -9`; restarts; asserts `system_recovered`; POSTs the decision; waits for completion; asserts llm calls unchanged by the resume, audit rows == previous + 1, no duplicate audit review_id, final value flowed to the report.
2. eval/chaos.py: env var CHAOS_KILL_AFTER_NODE=<node> makes the server os._exit(137) right after that node completes. Test mid-run kills after `locate`, `extract_llm`, `score`, `validate`. Assert zero extra LLM network calls vs a clean run and identical final metrics.
3. Repeat each scenario 10 times; write results to eval/results.json which /report reads for `kill_resume_tests`.
4. eval/report_check.py: recompute the report metrics independently from raw DB rows and compare to /report; fail on mismatch.
5. test_ground_truth_isolation: static import-graph check per RULES #1.
6. Double-submit test: POST same decision twice concurrently; exactly one audit row.
Report pass/fail with the raw outputs. If a test fails, write the diagnosis to NOTES.md for the BACKEND agent; do not edit /backend/app.
```

---

## Prompt 5 — Bug bash (hour ~18–21)

```
Run a bug bash on the integrated system. For each item: reproduce, fix (BACKEND agent) or report (others), add a regression test.
1. Company with no segment data → segment check shows skipped, no crash, no escalation.
2. Company with no Total liabilities (Alphabet/Amazon) → derived, equation passes, badge shown.
3. Company with NCI → equation uses NCI, no false escalation.
4. Forced LOW_CONF (inject wrong_row) → escalates with correct reason text and highlighted cell.
5. Corrected value flows into final report; audit row has original and corrected.
6. Reject → value excluded from accuracy, counted in rejected.
7. Correction that still fails validation → exactly one more review round, then unresolved.
8. Double click on Approve → one audit row.
9. Restart server with 3 runs paused and 1 running → all recover; UI replays events from since_seq.
10. Change confidence_threshold in /config → next run escalation count changes; report snapshot records the config.
Output a table of results.
```

---

## Your personal checklist at each gate

| Gate | You verify with your own eyes |
|---|---|
| G1 | Toy run survives `kill -9`; `UPDATE audit_log` fails in sqlite3 shell; `/audit/verify` ok |
| G2 | 3 numbers match the real statements; both extractors present; segment skipped cleanly somewhere |
| G3 | Corrected value shows as `final_value`; audit row has original+corrected |
| G4 | `groundtruth` imports only in verify/report; report numbers plausible; confusion matrix sums to total |
| G5 | Two timed dry runs; kill-resume demo works 3 times in a row on the demo machine |

## Demo day

- Run both `uvicorn` and the frontend from a script; **no `--reload`**.
- Keep a pre-warmed cache (`/data`) so network flakiness cannot hurt you; keep a fallback video of the kill-resume moment.
- Be ready to answer: "Why isn't accuracy circular?" (ground truth isolated, parser reads visible HTML only), "What if the LLM lies?" (second extractor + cross-checks + human gate), "How do you know your confidence means anything?" (calibration table), "What stops someone editing the audit log?" (triggers + hash chain + verify button).
- Keep the pitch at: problem (15s) → architecture slide (30s) → live run (90s) → kill-resume (60s) → report + audit (60s).

## Cut order if behind

MCP wrappers → adaptive thresholds → intro parallax → segment validation (keep as a skip flag) → extra companies down to 5. **Never cut:** kill-resume, calibration/confusion report, audit chain.
