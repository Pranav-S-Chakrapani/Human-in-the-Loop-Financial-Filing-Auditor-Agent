# SPEC.md — PS-01 Human-in-the-Loop Financial Filing Auditor

Binding spec. Read with RULES.md and CONTRACT.md before writing any code. Numbered sections are referenced by RULES.md and the Antigravity prompt packs — do not renumber.

## §1 Product

"VantageAudit" — an agent that fetches a real 10-K, extracts 8 financial metrics two independent ways, scores its own confidence, validates with accounting rules, auto-approves or pauses for a human, resumes from a durable checkpoint, and grades itself against SEC XBRL ground truth. The pitch: *a system that knows when to distrust itself, and proves it survives being killed mid-run.*

## §2 Scope for the 24h window

In scope: everything in PDF §3.1–3.8. MCP tool wrapping and adaptive thresholds are stretch-only (PDF §4 hints), never at the cost of §3.5/3.6/3.8.

## §3 Pipeline (LangGraph nodes, single agent)

`fetch → locate → extract_rules ∥ extract_llm → score → validate → triage → enqueue_reviews → human_review (loop) → apply_decisions → revalidate → ground_truth_verify → report`

- Two extractors (rules-based regex/table parse + LLM on the same located table) feed one confidence score. This is the one legitimate "multi-agent-ish" thing in the pitch — describe it exactly that way, not as a multi-agent system (stack in the PDF says "Agent Framework: LangGraph", singular).
- `human_review` is the only node allowed to call `interrupt()`, and it is the first statement in that node with nothing else before it (re-runs from top on every resume — RULES.md #6).

## §4 Repo layout

```
/backend
  /app
    /graph/nodes/      # one file per pipeline node
    /api/               # FastAPI routers matching CONTRACT.md
    models.py           # pydantic models for every CONTRACT.md object
    db.py                # schema + triggers (§6), WAL mode
    config.py            # loads config.yaml (§14)
    events.py            # event bus -> events table -> WS fanout
    llm.py                 # Groq client, llm_calls cache, Gemini fallback
    edgar.py               # EDGAR client, rate limiter, disk cache
    audit.py                # hash-chained append-only log
    groundtruth.py          # ONLY file that may import XBRL Company Facts (RULES #1)
  /tests
/frontend
  /src
    /screens/ (Intro, MissionControl, ReviewWorkbench, MetricsGrid, AuditLedger, Report)
    /mocks/    # one fixture per CONTRACT.md endpoint
    api.ts     # mock/real switch via VITE_USE_MOCKS
/eval
  kill_resume_test.py, chaos.py, report_check.py
/data
  /fixtures/<TICKER>/  # 10k.html, submissions.json, companyfacts.json
  /cache/               # gitignored EDGAR + LLM response cache
SPEC.md  CONTRACT.md  RULES.md  AGENTS.md  companies.json  config.yaml
```

## §5 The 8 metrics

Mandatory: Revenue, Net Income, Total Assets, Total Liabilities, Shareholders' Equity, Operating Cash Flow.
Team-picked: Gross Profit, Diluted EPS (clean, commonly tabulated, easy to validate). Each metric extracted for current AND prior year (16 values/company → ~80–128 across 5–8 companies).

## §6 Database schema (SQLite, WAL mode, `app.db`; checkpoints live separately in `checkpoints.db`)

```sql
CREATE TABLE runs (
  run_id TEXT PRIMARY KEY, ticker TEXT, company TEXT, cik TEXT, accession TEXT,
  fiscal_year INTEGER, status TEXT, current_node TEXT, fault_mode TEXT,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE node_runs (
  run_id TEXT, node TEXT, status TEXT, started_at TEXT, finished_at TEXT,
  PRIMARY KEY (run_id, node)
);

CREATE TABLE metrics (
  metric_id TEXT PRIMARY KEY, run_id TEXT, metric TEXT, period_label TEXT,
  period_end TEXT, is_current INTEGER, unit_label TEXT, scale INTEGER,
  value_a REAL, value_b REAL, value_dollars REAL,
  snippet_text TEXT, snippet_html TEXT, source_ref TEXT, -- JSON
  confidence REAL, confidence_breakdown TEXT, -- JSON
  method TEXT, decision_status TEXT, final_value REAL,
  fault_injected INTEGER DEFAULT 0, ground_truth TEXT -- JSON, nullable
);

CREATE TABLE validations (
  validation_id TEXT PRIMARY KEY, run_id TEXT, metric_id TEXT, check_type TEXT,
  status TEXT, phase TEXT, detail TEXT, explanation TEXT -- JSON
);

CREATE TABLE reviews (
  review_id TEXT PRIMARY KEY, run_id TEXT, metric_id TEXT, round INTEGER,
  status TEXT, reasons TEXT, -- JSON array of {code,text}
  created_at TEXT,
  UNIQUE(run_id, metric_id, round)
);

CREATE TABLE audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, review_id TEXT UNIQUE, run_id TEXT,
  company TEXT, metric TEXT, period TEXT, original_value REAL, corrected_value REAL,
  decision TEXT, reviewer TEXT, note TEXT, reasons TEXT, confidence REAL,
  ts TEXT, prev_hash TEXT, row_hash TEXT
);
-- append-only triggers (RULES #14)
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log
  BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE TABLE events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, ts TEXT, type TEXT, payload TEXT
);

CREATE TABLE llm_calls (
  cache_key TEXT PRIMARY KEY, -- sha256(model+prompt)
  model TEXT, response TEXT, ts TEXT
);

CREATE TABLE http_cache (
  cache_key TEXT PRIMARY KEY, url TEXT, response_body TEXT, status INTEGER, ts TEXT
);
```

Hash chain: `row_hash = sha256(prev_hash + canonical_json(row_without_hash_fields))`, insert inside `BEGIN IMMEDIATE`.

## §7 Node contracts

See the ANTIGRAVITY_PROMPTS.md stage prompts (G1–G4) — they are the operational spec for each node and are binding alongside this file.

## §8 Extraction rule (critical — RULES #1, #2)

Rules + LLM extractors read ONLY the visible-text HTML of the located statement tables. Never read `ix:*` tags, `contextRef`, R-files, or EdgarTools/Company Facts/Frames APIs during extraction. `groundtruth.py` is the only file permitted to import XBRL data, called only from `verify` and `report` nodes. A static import-graph test enforces this.

## §9 Validation rules

- **Equation:** Assets = Liabilities + Equity. If no "Total liabilities" line exists (e.g. some tech/consumer filers), derive it as Assets − Equity and mark `method: derived`, never escalate on that basis alone. Include NCI in equity where present.
- **YoY:** configurable % threshold, prior year pulled from the same filing's comparative column (no second fetch).
- **Segment:** sum of segment revenue vs. total revenue where a segment table exists; `skipped` cleanly otherwise — never crashes.
- **Cross-statement:** net income on the income statement must equal the starting line of the cash flow statement (pin "attributable to parent" vs. consolidated per company in prep).

## §10 Decision flow (durable-first)

Audit row + review status commit in one transaction BEFORE `Command(resume=...)` is called. `correct` requires `corrected_value` + `note`; `reject` requires `note`; repeat POSTs to a decided review return `duplicate:true`, one audit row only. Max 2 review rounds after a correction, then `unresolved`. Rejected values excluded from accuracy numerator/denominator, counted separately.

## §11 Scoring

`confidence = w1*(rules_vs_llm_agreement) + w2*(label_match_quality) + w3*(cross_statement_corroboration)`, weights in config.yaml. Disagreement between the two extractors caps the score at `disagree_cap` (default 0.4) regardless of the other two signals.

## §12 Fault injection (so the human-review demo isn't empty)

`POST /admin/inject-fault {ticker, mode}` arms one of `wrong_column | wrong_scale | wrong_row | llm_hallucination` for that ticker's next run. Injected values are tagged `fault_injected=1` and never blended into the natural-accuracy numbers (RULES #3).

## §13 Report

Exactly the shape in CONTRACT.md `GET /report` — totals, raw/auto-approved/post-review accuracy, confusion matrix (approved_correct / approved_wrong / escalated_wrong / escalated_correct), escalation precision (lenient + strict), calibration buckets, reliability counters (unique vs duplicate LLM calls, audit row count, chain_ok, kill-resume test pass rate), natural-vs-fault-injected split. All computed from DB rows only — no hard-coded numbers outside mock mode (which is visibly badged "MOCK").

## §14 config.yaml (no magic numbers in node code — RULES #5)

```yaml
confidence_threshold: 0.75
yoy_threshold_pct: 50
equation_tolerance_pct: 0.5
disagree_cap: 0.4
scoring_weights: { agree: 0.5, label: 0.3, cross: 0.2 }
max_review_rounds: 2
llm:
  concurrency: 3
  model: "<pinned from docs/llm_notes.md after P2>"
edgar:
  max_rps: 8
  user_agent: "VantageAudit your_real_email@example.com"
```

## §15 Frontend screens

Intro (parallax, skippable, 10–15s) → Mission Control (xyflow pipeline canvas, live WS, amber on interrupt) → Review Workbench (queue / statement with highlighted cell / confidence breakdown, A/E/R keys) → Metrics Grid (confidence heatmap) → Audit Ledger (hash chain + verify + tamper demo) → Report (confusion matrix, calibration, reliability counters). Dark, dense, tabular-nums, motion only for state change, parallax confined to Intro only (RULES §G, #29–30).

**Signature interaction (beyond the PDF's ask):** the Mission Control canvas pulsing live over WebSocket as the real backend executes — this is the one effect in the whole brief that's provably real, not decorative, and it's unique to this submission. Prioritize it over magnetic buttons/staggered reveals if time runs short; those are nice-to-have polish on the Intro screen only, not judged.

## §16 Business scaling note (brief — don't over-invest hackathon time here)

MVP → pilot: point this at a small accounting firm's review queue instead of hackathon demo companies; same pipeline, same audit log. Revenue model: per-seat reviewer dashboard + per-filing processing fee. Moat isn't the extraction (commoditizing fast) — it's the audit trail + calibration history accumulating per customer, which a competitor can't retroactively produce. One slide on this at the end of the pitch is enough; do not build anything for it tonight.
