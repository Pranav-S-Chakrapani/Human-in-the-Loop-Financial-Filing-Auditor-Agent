# CONTRACT.md — API & Event Contract

The frontend builds against this with mocks from minute zero; the backend must match it exactly. Any change = edit this file first, then both sides.

Base URL: `http://localhost:8000`. JSON everywhere. Timestamps ISO-8601 UTC. Money values in **whole dollars** (`value_dollars`), except `diluted_eps` (USD/share).

## Enums

```
run.status:        queued | running | paused | completed | failed
decision_status:   auto_approved | pending_review | approved | corrected | rejected | not_reported | unresolved
method:            agree | rules_only | llm_only | derived | disagree
reason.code:       LOW_CONF | EQ_FAIL | YOY_ANOMALY | CROSS_STATEMENT | SEGMENT_MISMATCH | NOT_FOUND | EXTRACTOR_DISAGREE
check_type:        equation | yoy | segment | cross_statement
check.status:      passed | failed | skipped
decision:          approve | correct | reject
node:              fetch | locate | extract_rules | extract_llm | score | validate | triage |
                   enqueue_reviews | human_review | apply_decisions | revalidate |
                   ground_truth_verify | report
fault_mode:        wrong_column | wrong_scale | wrong_row | llm_hallucination
```

## Runs

### `POST /runs`
```json
// request
{ "companies": ["AAPL","MSFT","KO"], "fault_mode": null }
// response 202
{ "runs": [ { "run_id": "r_8f3a", "ticker": "AAPL", "status": "queued" } ] }
```
`companies` are tickers present in `companies.json` (pinned CIK + accession).

### `GET /runs`
```json
[ { "run_id":"r_8f3a","company":"Apple Inc.","ticker":"AAPL","fiscal_year":2025,
    "status":"paused","current_node":"human_review",
    "counts":{"metrics":16,"auto_approved":13,"pending":2,"decided":1},
    "created_at":"2026-11-12T07:01:11Z","updated_at":"2026-11-12T07:03:40Z" } ]
```

### `GET /runs/{run_id}`
```json
{
  "run_id":"r_8f3a","company":"Apple Inc.","ticker":"AAPL","cik":"0000320193",
  "accession":"0000320193-25-000079","fiscal_year":2025,"status":"paused",
  "current_node":"human_review","fault_mode":null,
  "nodes":[ {"node":"fetch","status":"done","finished_at":"..."},
            {"node":"human_review","status":"interrupted","finished_at":null} ],
  "metrics":[ /* Metric[] */ ],
  "validations":[ /* Validation[] */ ],
  "last_checkpoint_at":"2026-11-12T07:03:40Z"
}
```

### Metric object
```json
{
  "metric_id":"m_001","run_id":"r_8f3a","metric":"total_assets",
  "period_label":"Sep. 27, 2025","period_end":"2025-09-27","is_current":true,
  "unit_label":"in millions","scale":1000000,
  "value_a":364980,"value_b":364980,"value_dollars":364980000000,
  "snippet_text":"Total assets | $364,980 | $352,583",
  "snippet_html":"<tr>…</tr>","source_ref":{"table_id":"bs_1","row":14,"col":1,
      "edgar_url":"https://www.sec.gov/Archives/edgar/data/320193/…"},
  "confidence":0.96,
  "confidence_breakdown":{"agree":1.0,"label":1.0,"cross":0.5,"sanity":1.0,"cap_applied":false},
  "method":"agree","decision_status":"auto_approved","final_value":364980000000,
  "fault_injected":false,
  "ground_truth":null        // only populated after ground_truth_verify: {"value":..., "correct":true}
}
```

### Validation object
```json
{ "validation_id":"v_01","check_type":"equation","metric":"total_assets","status":"passed",
  "phase":"initial","detail":{"assets":364980,"liabilities":308030,"equity":56950,"nci":0,
  "delta":0,"tolerance":1824.9},"explanation":null }
```
YoY failures include `"explanation":"Revenue fell 62% YoY, likely …"` (LLM, cached).
Segment skipped: `{"status":"skipped","detail":{"reason":"no segment table found"}}`.

## Reviews

### `GET /reviews?status=pending|decided|all&run_id=&company=`
```json
[ { "review_id":"rv_12","run_id":"r_8f3a","company":"Apple Inc.","metric":"revenue",
    "period_label":"FY2025","round":1,"status":"pending","actionable":true,
    "reasons":[{"code":"YOY_ANOMALY","text":"Revenue changed +212% vs prior year (threshold 50%)"}],
    "confidence":0.62,"created_at":"..." } ]
```
`actionable=true` only for the head-of-queue review of its run; others are `false` ("queued behind").

### `GET /reviews/{review_id}`
```json
{
  "review_id":"rv_12","status":"pending","actionable":true,"round":1,
  "metric": { /* Metric object */ },
  "reasons":[ {"code":"EQ_FAIL","text":"Assets ≠ Liabilities + Equity (Δ 12,400)"} ],
  "validations":[ /* related Validation[] */ ],
  "statement_html":"<table>…</table>",             // located statement with data-cell-id attributes
  "highlight":{"row":14,"col":1},
  "other_extractor":{"rules":364980,"llm":364890},
  "decision":null
}
```

### `POST /reviews/{review_id}/decision`
```json
// request
{ "decision":"correct", "corrected_value":364980000000, "reviewer":"pranav", "note":"Rules grabbed prior-year column" }
// response 200 (idempotent: repeating returns same body with "duplicate": true)
{ "review_id":"rv_12","decision":"correct","audit_seq":7,"audit_hash":"9c1e…","run_status":"running","duplicate":false }
```
Validation: `corrected_value` required for `correct`; `note` required for `correct` and `reject`; 409 if the review is not actionable; 404 unknown.

## Audit

### `GET /audit?limit=&after_seq=`
```json
[ { "seq":7,"review_id":"rv_12","run_id":"r_8f3a","company":"Apple Inc.","metric":"revenue",
    "period":"FY2025","original_value":416161000000,"corrected_value":416161000000,
    "decision":"approve","reviewer":"pranav","note":"","reasons":["YOY_ANOMALY"],
    "confidence":0.62,"ts":"...","prev_hash":"ab12…","row_hash":"9c1e…" } ]
```

### `GET /audit/verify`
```json
{ "ok":true,"rows":7,"head_hash":"9c1e…","first_bad_seq":null }
```

### `POST /admin/tamper` (demo only)
Tries `UPDATE audit_log SET …` and `DELETE FROM audit_log …` on a real row.
```json
{ "update_blocked":true,"delete_blocked":true,
  "errors":["audit_log is append-only","audit_log is append-only"] }
```

## Report

### `GET /report`
```json
{
  "generated_at":"...",
  "totals":{"companies":8,"values":128,"current_year_values":64,"auto_approved":51,"escalated":13,
            "approved":6,"corrected":4,"rejected":1,"unresolved":2},
  "accuracy":{"raw":0.953,"auto_approved":0.992,"post_review":0.998,
              "per_metric":{"revenue":0.97},"per_company":{"AAPL":0.98}},
  "confusion":{"approved_correct":50,"approved_wrong":1,"escalated_wrong":9,"escalated_correct":4},
  "escalation_precision":{"lenient":0.92,"strict":0.69},
  "calibration":[ {"bucket":"0.9-1.0","n":40,"accuracy":1.0}, {"bucket":"0.8-0.9","n":11,"accuracy":0.91} ],
  "reliability":{"unique_llm_calls":96,"duplicate_llm_calls":0,"audit_rows":11,
                 "chain_ok":true,"kill_resume_tests":{"passed":10,"total":10}},
  "split":{"natural":{"accuracy_raw":0.97,"escalated":6},"fault_injected":{"accuracy_raw":0.71,"escalated":7}},
  "config_snapshot":{ }
}
```

## Config / admin

- `GET /config` → current config.yaml as JSON. `PUT /config` → validates and applies (affects triage on next run; does not rewrite history).
- `POST /admin/inject-fault` `{ "ticker":"MSFT","mode":"wrong_column" }` → arms a fault for the next run of that ticker.
- `GET /health` → `{ "ok":true,"checkpointer":"sqlite","llm_calls":96,"audit_rows":11,"recovered_runs":["r_8f3a"] }`
- `GET /counters` → `{ "llm_calls":96,"audit_rows":11,"events":412 }` (UI polls on load; WS keeps it live)

## WebSocket `WS /ws/events?since_seq=N`

On connect, the server first **replays persisted events with `seq > since_seq`**, then streams live. Envelope:
```json
{ "seq":412,"ts":"...","run_id":"r_8f3a","type":"node_completed","payload":{ } }
```

| type | payload |
|---|---|
| `run_created` | `{ticker, company}` |
| `node_started` | `{node}` |
| `node_completed` | `{node, summary}` |
| `node_skipped` | `{node, reason:"already_done"}` (visible after a resume — nice for demo) |
| `llm_call` | `{purpose, cached:boolean, total_unique_calls}` |
| `metric_extracted` | `{metric_id, metric, confidence, method}` |
| `validation_result` | `{check_type, status, metric}` |
| `review_enqueued` | `{review_id, metric, reasons}` |
| `run_paused` | `{review_id}` |
| `review_decided` | `{review_id, decision, audit_seq}` |
| `run_resumed` | `{from_checkpoint:true}` |
| `audit_appended` | `{seq, row_hash}` |
| `run_completed` | `{accuracy_raw, escalated}` |
| `run_failed` | `{error}` |
| `system_recovered` | `{resumed_runs:[...], replayed_decisions:[...]}` |

## Mock mode (frontend)

`VITE_USE_MOCKS=true` serves fixtures from `/frontend/src/mocks/*.json` (one file per endpoint above, ≥3 companies, ≥6 pending reviews with all reason types, an audit chain of ≥8 rows, a full report) and runs a mock event emitter replaying a scripted pipeline with one pause + one resume. Real/mocked switching is one env flag and must not change component code.
