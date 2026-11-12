// CONTRACT.md compliant mock fixtures

export const MOCK_HEALTH = {
  ok: true,
  checkpointer: "sqlite",
  llm_calls: 96,
  audit_rows: 11,
  recovered_runs: ["r_8f3a"]
};

export const MOCK_COUNTERS = {
  llm_calls: 96,
  audit_rows: 11,
  events: 412
};

export const MOCK_RUNS = [
  {
    run_id: "r_8f3a",
    company: "Apple Inc.",
    ticker: "AAPL",
    fiscal_year: 2026,
    status: "paused",
    current_node: "human_review",
    counts: { metrics: 16, auto_approved: 13, pending: 2, decided: 1 },
    created_at: "2026-11-12T07:01:11Z",
    updated_at: "2026-11-12T07:03:40Z"
  },
  {
    run_id: "r_9b2c",
    company: "The Coca-Cola Company",
    ticker: "KO",
    fiscal_year: 2025,
    status: "running",
    current_node: "validate",
    counts: { metrics: 16, auto_approved: 14, pending: 0, decided: 0 },
    created_at: "2026-11-12T07:05:00Z",
    updated_at: "2026-11-12T07:05:30Z"
  }
];

export const MOCK_REVIEWS = [
  {
    review_id: "rv_12",
    run_id: "r_8f3a",
    company: "Apple Inc.",
    metric: "revenue",
    period_label: "FY2026",
    round: 1,
    status: "pending",
    actionable: true,
    reasons: [
      { code: "YOY_ANOMALY", text: "Revenue changed +212% vs prior year (threshold 50%)" }
    ],
    confidence: 0.62,
    created_at: "2026-11-12T07:03:40Z"
  }
];

export const MOCK_AUDIT = [
  {
    seq: 1,
    review_id: "rv_01",
    run_id: "r_8f3a",
    company: "Apple Inc.",
    metric: "revenue",
    period: "FY2026",
    original_value: 416161000000,
    corrected_value: 478834000000,
    decision: "correct",
    reviewer: "pranav",
    note: "Rules grabbed prior-year column",
    reasons: ["YOY_ANOMALY"],
    confidence: 0.62,
    ts: "2026-11-12T07:04:00Z",
    prev_hash: "",
    row_hash: "9c1e4b3a88df79a1f284e601c4568b6b23d9a101b2384a56c7104f981e4b3a88"
  }
];
