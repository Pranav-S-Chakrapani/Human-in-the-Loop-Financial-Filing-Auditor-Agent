# RULES.md — Hard constraints (also use as AGENTS.md / workspace rules)

Read SPEC.md and CONTRACT.md before writing code. If a rule here conflicts with convenience, the rule wins. If a rule conflicts with SPEC/CONTRACT, stop and ask the human.

## A. Integrity of the evaluation (judges will probe these)

1. **Ground truth is isolated.** XBRL Company Facts is imported only in `groundtruth.py`, called only from `verify.py` and `report.py`. No extraction, scoring, validation or triage code may import it. A test (`test_ground_truth_isolation`) greps the import graph and fails if violated.
2. **Extraction never reads XBRL.** Parse the 10-K HTML as a visual document (element text only). Do not read any `ix:*` tags/attributes, `name=`, `contextRef`, R-files, `Financial_Report.xlsx`, or use EdgarTools / the Company Facts / Frames APIs for extraction.
3. **Never blend injected and natural results.** Fault-injected values carry `fault_injected=1`; the report splits them.
4. **No fabricated numbers.** Report metrics are computed from stored rows only. No hard-coded accuracy, counts or sample outputs anywhere (including UI fallbacks except in mock mode, which is visibly badged "MOCK").
5. **Config, not constants.** Thresholds, tolerances, weights, concurrency live in `config.yaml`. No magic numbers in node code.

## B. Workflow correctness

6. **`interrupt()` is the first statement of its node** and the node contains nothing else with side effects before it. `human_review` is the only node that calls `interrupt()`. Never wrap `interrupt()` in try/except. The node **re-runs from its top on every resume** (confirmed current LangGraph behavior) — this is why rule #8 (idempotency) is not optional. The value passed to `interrupt()` and the value passed back via `Command(resume=...)` must both be plain JSON (dict/list/str/number/bool) — never a Pydantic object, dataclass, or anything non-serializable.
7. **State holds ids and paths only** — never HTML, tables, or large JSON. Everything big goes to disk or SQLite.
8. **Every node is idempotent:** check `node_runs` first; use unique keys + upserts (`INSERT … ON CONFLICT DO UPDATE/NOTHING`); emit events after the DB write.
9. **All LLM calls go through `llm.py`**, which caches by `sha256(model + prompt)` in `llm_calls` *before* returning. A resumed or re-run node must produce zero new network calls. Counters count real network calls only.
10. **Decision flow is durable-first:** audit row + review status commit in one transaction **before** `Command(resume=…)`. The startup reconciler resumes paused runs whose head review is already decided, and resumes `running` runs with `ainvoke(None, config)`.
11. **Checkpointer:** `AsyncSqliteSaver` on `checkpoints.db` (separate from `app.db`). Never `InMemorySaver`. One `thread_id` = one `run_id`. Set `LANGGRAPH_STRICT_MSGPACK=true` in the environment when constructing it — this restricts checkpoint deserialization to known-safe types, which matters since judges may poke at the running system.
12. Bounded concurrency: at most `llm.concurrency` simultaneous LLM calls; EDGAR ≤ `edgar.max_rps`.
13. A corrected value triggers `revalidate`; max `max_review_rounds` rounds, then `unresolved`. Rejected values are excluded from accuracy numerators and denominators and counted separately.

## C. Audit log

14. **Insert-only.** No `UPDATE`/`DELETE` statements against `audit_log` anywhere in code. DB triggers `RAISE(ABORT)` on both. Tests assert both statements fail.
15. Hash chain: `row_hash = sha256(prev_hash + canonical_json(row))`; inserts run in `BEGIN IMMEDIATE`; `audit_log.review_id` is UNIQUE (idempotency). `/audit/verify` recomputes the entire chain.
16. Every row includes original value, corrected value (nullable), decision, reviewer, note, reasons, confidence, timestamp.

## D. EDGAR & LLM hygiene

17. Every EDGAR request sends `User-Agent` from config (app name + real contact email), respects the rate limiter, retries with backoff on 429/5xx, and is disk-cached. Pinned accessions in `companies.json` make runs deterministic and offline-capable.
18. Send the LLM **only** the located statement tables (plain text), never the full 10-K. Temperature 0. JSON-validated output with one repair retry; on failure return `null` (never guess).
19. Keys live in `.env` (gitignored). Never log keys. Never commit `data/` caches except pinned fixtures.

## E. Parsing robustness

20. Handle: `(1,234)` negatives, `—` as zero, `$` and footnote markers, "in millions/thousands/billions", "except per share", merged header cells, multi-row headers, tables split across `<tr>` with spacer cells.
21. Missing data never crashes a run: no segment table → `skipped`; no Gross Profit → `not_reported`; no Total liabilities → `derived`.
22. A node failure marks the run `failed` with the error, emits `run_failed`, and does not take down other runs.

## F. Engineering conduct

23. **All code is written during the event.** Do not copy from earlier projects or paste from other repos. Open-source libraries are fine.
24. File ownership — an agent edits only its own directory:
    - Agent BACKEND → `/backend/**`
    - Agent FRONTEND → `/frontend/**`
    - Agent EVAL → `/eval/**` and `/backend/tests/**`
    - Spec files (`SPEC.md`, `CONTRACT.md`, `RULES.md`) → human only. If you think a spec change is needed, write it in `NOTES.md` and stop.
25. Tests first for the risky parts: interrupt/resume, audit triggers, hash chain, unit/scale normalization, ground-truth matching, confusion matrix math.
26. Small commits; tag at each gate: `g1-spine`, `g2-extract`, `g3-live`, `g4-scale`, `g5-ui`.
27. When something is ambiguous, pick the simplest option that satisfies the spec and note the assumption in `NOTES.md`. Do not ask the human mid-run for trivia.
28. Frontend never hard-codes endpoints or fake data outside `src/mocks/`; one `api.ts` layer switches mock/real via `VITE_USE_MOCKS`.

## G. UI rules

29. Dark, dense, tabular numerals (`font-variant-numeric: tabular-nums`). Motion only to show state change. Respect `prefers-reduced-motion`.
30. Parallax/scroll effects only on the Intro screen. Never on Review Workbench or Report.
31. Every number in the UI must be traceable: clicking a value shows source snippet, table, EDGAR link, confidence breakdown, and validations.
32. The kill-resume proof must be visible in the UI: counters (LLM calls, audit rows) and a `system_recovered` toast after restart.

## H. Definition of done (per gate)

- Gate tests in `/eval` pass, working tree clean, tag created, `NOTES.md` updated with assumptions and known gaps.
- No TODOs in the critical path (interrupt node, audit, verifier, report).
