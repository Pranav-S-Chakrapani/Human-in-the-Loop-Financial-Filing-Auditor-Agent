// CONTRACT.md compliant mock fixtures & scripted mock event emitter

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
    cik: "0000320193",
    accession: "0000320193-26-000026",
    fiscal_year: 2026,
    status: "paused",
    current_node: "human_review",
    fault_mode: null,
    counts: { metrics: 16, auto_approved: 13, pending: 2, decided: 1 },
    created_at: "2026-11-12T07:01:11Z",
    updated_at: "2026-11-12T07:03:40Z",
    nodes: [
      { node: "fetch", status: "done", finished_at: "2026-11-12T07:01:15Z" },
      { node: "locate", status: "done", finished_at: "2026-11-12T07:01:20Z" },
      { node: "extract_rules", status: "done", finished_at: "2026-11-12T07:01:25Z" },
      { node: "extract_llm", status: "done", finished_at: "2026-11-12T07:01:30Z" },
      { node: "score", status: "done", finished_at: "2026-11-12T07:01:32Z" },
      { node: "validate", status: "done", finished_at: "2026-11-12T07:01:34Z" },
      { node: "triage", status: "done", finished_at: "2026-11-12T07:01:35Z" },
      { node: "enqueue_reviews", status: "done", finished_at: "2026-11-12T07:01:36Z" },
      { node: "human_review", status: "interrupted", finished_at: null }
    ]
  },
  {
    run_id: "r_9b2c",
    company: "Microsoft Corporation",
    ticker: "MSFT",
    cik: "0000789019",
    accession: "0001193125-26-323660",
    fiscal_year: 2026,
    status: "completed",
    current_node: "done",
    fault_mode: "wrong_column",
    counts: { metrics: 16, auto_approved: 14, pending: 0, decided: 2 },
    created_at: "2026-11-12T07:05:00Z",
    updated_at: "2026-11-12T07:06:30Z",
    nodes: [
      { node: "fetch", status: "done", finished_at: "2026-11-12T07:05:05Z" },
      { node: "locate", status: "done", finished_at: "2026-11-12T07:05:10Z" },
      { node: "extract_rules", status: "done", finished_at: "2026-11-12T07:05:15Z" },
      { node: "extract_llm", status: "done", finished_at: "2026-11-12T07:05:20Z" },
      { node: "score", status: "done", finished_at: "2026-11-12T07:05:22Z" },
      { node: "validate", status: "done", finished_at: "2026-11-12T07:05:25Z" },
      { node: "triage", status: "done", finished_at: "2026-11-12T07:05:27Z" },
      { node: "enqueue_reviews", status: "done", finished_at: "2026-11-12T07:05:28Z" },
      { node: "human_review", status: "done", finished_at: "2026-11-12T07:06:10Z" },
      { node: "apply_decisions", status: "done", finished_at: "2026-11-12T07:06:12Z" },
      { node: "ground_truth_verify", status: "done", finished_at: "2026-11-12T07:06:20Z" },
      { node: "report", status: "done", finished_at: "2026-11-12T07:06:22Z" }
    ]
  },
  {
    run_id: "r_4d1a",
    company: "The Coca-Cola Company",
    ticker: "KO",
    cik: "0000021344",
    accession: "0001628280-26-010047",
    fiscal_year: 2025,
    status: "running",
    current_node: "extract_llm",
    fault_mode: null,
    counts: { metrics: 8, auto_approved: 0, pending: 0, decided: 0 },
    created_at: "2026-11-12T07:10:00Z",
    updated_at: "2026-11-12T07:10:15Z",
    nodes: [
      { node: "fetch", status: "done", finished_at: "2026-11-12T07:10:05Z" },
      { node: "locate", status: "done", finished_at: "2026-11-12T07:10:10Z" },
      { node: "extract_rules", status: "done", finished_at: "2026-11-12T07:10:15Z" },
      { node: "extract_llm", status: "running", finished_at: null }
    ]
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
  },
  {
    review_id: "rv_13",
    run_id: "r_8f3a",
    company: "Apple Inc.",
    metric: "shareholders_equity",
    period_label: "FY2026",
    round: 1,
    status: "pending",
    actionable: false, // queued behind rv_12
    reasons: [
      { code: "EQ_FAIL", text: "Assets ≠ Liabilities + Equity (Δ 12,400)" }
    ],
    confidence: 0.58,
    created_at: "2026-11-12T07:03:41Z"
  },
  {
    review_id: "rv_14",
    run_id: "r_9b2c",
    company: "Microsoft Corporation",
    metric: "gross_profit",
    period_label: "FY2026",
    round: 1,
    status: "pending",
    actionable: true,
    reasons: [
      { code: "LOW_CONF", text: "Confidence 0.65 below threshold 0.75" }
    ],
    confidence: 0.65,
    created_at: "2026-11-12T07:05:28Z"
  },
  {
    review_id: "rv_15",
    run_id: "r_4d1a",
    company: "The Coca-Cola Company",
    metric: "net_income",
    period_label: "FY2025",
    round: 1,
    status: "pending",
    actionable: true,
    reasons: [
      { code: "CROSS_STATEMENT", text: "Net income does not match cash flow starting value" }
    ],
    confidence: 0.45,
    created_at: "2026-11-12T07:10:15Z"
  },
  {
    review_id: "rv_16",
    run_id: "r_4d1a",
    company: "The Coca-Cola Company",
    metric: "revenue",
    period_label: "FY2025",
    round: 1,
    status: "pending",
    actionable: false,
    reasons: [
      { code: "SEGMENT_MISMATCH", text: "Segment sum $45,200M does not match total $47,941M" }
    ],
    confidence: 0.70,
    created_at: "2026-11-12T07:10:16Z"
  },
  {
    review_id: "rv_17",
    run_id: "r_4d1a",
    company: "The Coca-Cola Company",
    metric: "total_liabilities",
    period_label: "FY2025",
    round: 1,
    status: "pending",
    actionable: false,
    reasons: [
      { code: "EXTRACTOR_DISAGREE", text: "Rules ($72,647M) and LLM ($68,100M) disagreed" },
      { code: "NOT_FOUND", text: "No explicit 'Total liabilities' row found on balance sheet" }
    ],
    confidence: 0.40,
    created_at: "2026-11-12T07:10:17Z"
  }
];

export const MOCK_REVIEW_DETAIL: Record<string, any> = {
  rv_12: {
    review_id: "rv_12",
    status: "pending",
    actionable: true,
    round: 1,
    metric: {
      metric_id: "m_r_8f3a_revenue",
      run_id: "r_8f3a",
      metric: "revenue",
      period_label: "Sep. 26, 2026",
      period_end: "2026-09-26",
      is_current: true,
      unit_label: "in millions",
      scale: 1000000,
      value_a: 478834,
      value_b: 478834,
      value_dollars: 478834000000,
      snippet_text: "Total net sales | $478,834 | $416,161",
      snippet_html: `<tr><td class="font-medium p-2 text-slate-200">Total net sales</td><td class="p-2 text-right text-slate-400">$</td><td class="p-2 text-right font-mono bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">478,834</td><td class="p-2 text-right text-slate-400">$</td><td class="p-2 text-right font-mono text-slate-300">416,161</td></tr>`,
      source_ref: {
        table_id: "is_table_12",
        row: 8,
        col: 2,
        edgar_url: "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm"
      },
      confidence: 0.62,
      confidence_breakdown: {
        agree: 1.0,
        label: 1.0,
        cross: 0.5,
        sanity: 1.0,
        cap_applied: false
      },
      method: "agree",
      decision_status: "pending_review",
      final_value: null,
      fault_injected: false,
      ground_truth: null
    },
    reasons: [
      { code: "YOY_ANOMALY", text: "Revenue changed +212% vs prior year (threshold 50%)" }
    ],
    validations: [
      {
        validation_id: "v_yoy_01",
        check_type: "yoy",
        metric: "revenue",
        status: "failed",
        phase: "initial",
        detail: { current: 478834000000, prior: 416161000000, pct_change: 15.06, threshold_pct: 50 },
        explanation: "Consumer hardware upgrades and services revenue acceleration drove volume expansion."
      },
      {
        validation_id: "v_seg_01",
        check_type: "segment",
        metric: "revenue",
        status: "skipped",
        phase: "initial",
        detail: { reason: "no segment table found" },
        explanation: null
      }
    ],
    statement_html: `<div class="overflow-x-auto"><table class="w-full text-xs text-left text-slate-300 border-collapse"><thead class="bg-slate-900 border-b border-slate-800"><tr><th class="p-2">Statements of Operations</th><th class="p-2 text-right" colspan="2">2026</th><th class="p-2 text-right" colspan="2">2025</th></tr></thead><tbody><tr class="border-b border-slate-900/60"><td class="p-2">Products</td><td class="p-2 text-right">$</td><td class="p-2 text-right font-mono">312,185</td><td class="p-2 text-right">$</td><td class="p-2 text-right font-mono">298,085</td></tr><tr class="border-b border-slate-900/60"><td class="p-2">Services</td><td class="p-2 text-right">$</td><td class="p-2 text-right font-mono">166,649</td><td class="p-2 text-right">$</td><td class="p-2 text-right font-mono">118,076</td></tr><tr class="bg-amber-500/10 border-t border-b border-amber-500/30"><td class="p-2 font-bold text-amber-200">Total net sales</td><td class="p-2 text-right text-amber-400">$</td><td class="p-2 text-right font-mono font-bold text-amber-300">478,834</td><td class="p-2 text-right text-slate-400">$</td><td class="p-2 text-right font-mono text-slate-300">416,161</td></tr></tbody></table></div>`,
    highlight: { row: 8, col: 2 },
    other_extractor: { rules: 478834, llm: 478834 },
    decision: null
  }
};

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
    prev_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    row_hash: "9c1e4b3a88df79a1f284e601c4568b6b23d9a101b2384a56c7104f981e4b3a88"
  },
  {
    seq: 2,
    review_id: "rv_02",
    run_id: "r_8f3a",
    company: "Apple Inc.",
    metric: "total_assets",
    period: "FY2026",
    original_value: 404548000000,
    corrected_value: 404548000000,
    decision: "approve",
    reviewer: "pranav",
    note: "Verified against balance sheet note 4",
    reasons: [],
    confidence: 0.95,
    ts: "2026-11-12T07:04:30Z",
    prev_hash: "9c1e4b3a88df79a1f284e601c4568b6b23d9a101b2384a56c7104f981e4b3a88",
    row_hash: "a4f210d7e8b91c2384d7a89e1c457193b2e819ac405e6b72183e910f4bc921a3"
  },
  {
    seq: 3,
    review_id: "rv_03",
    run_id: "r_9b2c",
    company: "Microsoft Corporation",
    metric: "revenue",
    period: "FY2026",
    original_value: 281724000000,
    corrected_value: 331839000000,
    decision: "correct",
    reviewer: "elena",
    note: "Fault injected: wrong comparative column",
    reasons: ["LOW_CONF", "EXTRACTOR_DISAGREE"],
    confidence: 0.40,
    ts: "2026-11-12T07:06:00Z",
    prev_hash: "a4f210d7e8b91c2384d7a89e1c457193b2e819ac405e6b72183e910f4bc921a3",
    row_hash: "3b8c91a02f4d5e71829304a5b6c7d8e9f0123456789abcdef0123456789abcde"
  },
  {
    seq: 4,
    review_id: "rv_04",
    run_id: "r_9b2c",
    company: "Microsoft Corporation",
    metric: "gross_profit",
    period: "FY2026",
    original_value: 225465000000,
    corrected_value: 225465000000,
    decision: "approve",
    reviewer: "elena",
    note: "Rules only matched; LLM returned null. Human confirmed row 14.",
    reasons: ["LOW_CONF"],
    confidence: 0.65,
    ts: "2026-11-12T07:06:10Z",
    prev_hash: "3b8c91a02f4d5e71829304a5b6c7d8e9f0123456789abcdef0123456789abcde",
    row_hash: "7d8e9f0123456789abcdef0123456789abcde3b8c91a02f4d5e71829304a5b6c"
  },
  {
    seq: 5,
    review_id: "rv_05",
    run_id: "r_4d1a",
    company: "The Coca-Cola Company",
    metric: "gross_profit",
    period: "FY2025",
    original_value: 29544000000,
    corrected_value: 29544000000,
    decision: "approve",
    reviewer: "marcus",
    note: "Verified margin calculation",
    reasons: [],
    confidence: 0.90,
    ts: "2026-11-12T07:11:00Z",
    prev_hash: "7d8e9f0123456789abcdef0123456789abcde3b8c91a02f4d5e71829304a5b6c",
    row_hash: "e9f0123456789abcdef0123456789abcde3b8c91a02f4d5e71829304a5b6c7d8"
  },
  {
    seq: 6,
    review_id: "rv_06",
    run_id: "r_4d1a",
    company: "The Coca-Cola Company",
    metric: "shareholders_equity",
    period: "FY2025",
    original_value: 32169000000,
    corrected_value: 32169000000,
    decision: "approve",
    reviewer: "marcus",
    note: "Parent equity confirmed; NCI excluded appropriately",
    reasons: [],
    confidence: 0.90,
    ts: "2026-11-12T07:11:30Z",
    prev_hash: "e9f0123456789abcdef0123456789abcde3b8c91a02f4d5e71829304a5b6c7d8",
    row_hash: "456789abcdef0123456789abcde3b8c91a02f4d5e71829304a5b6c7d8e9f0123"
  },
  {
    seq: 7,
    review_id: "rv_07",
    run_id: "r_8f3a",
    company: "Apple Inc.",
    metric: "operating_cash_flow",
    period: "FY2026",
    original_value: 145097000000,
    corrected_value: 145097000000,
    decision: "approve",
    reviewer: "pranav",
    note: "Operating activities starting line reconciled",
    reasons: [],
    confidence: 0.90,
    ts: "2026-11-12T07:12:00Z",
    prev_hash: "456789abcdef0123456789abcde3b8c91a02f4d5e71829304a5b6c7d8e9f0123",
    row_hash: "abcdef0123456789abcde3b8c91a02f4d5e71829304a5b6c7d8e9f0123456789"
  },
  {
    seq: 8,
    review_id: "rv_08",
    run_id: "r_4d1a",
    company: "The Coca-Cola Company",
    metric: "diluted_eps",
    period: "FY2025",
    original_value: 3.04,
    corrected_value: null,
    decision: "reject",
    reviewer: "marcus",
    note: "Corrupted per-share currency field in test harness",
    reasons: ["LOW_CONF"],
    confidence: 0.35,
    ts: "2026-11-12T07:12:45Z",
    prev_hash: "abcdef0123456789abcde3b8c91a02f4d5e71829304a5b6c7d8e9f0123456789",
    row_hash: "f0123456789abcde3b8c91a02f4d5e71829304a5b6c7d8e9f0123456789abcde"
  }
];

export const MOCK_REPORT = {
  generated_at: "2026-11-12T07:15:00Z",
  totals: {
    companies: 8,
    values: 64,
    current_year_values: 64,
    auto_approved: 51,
    escalated: 11,
    approved: 11,
    corrected: 0,
    rejected: 0,
    unresolved: 0
  },
  accuracy: {
    raw: 0.891,
    auto_approved: 0.882,
    post_review: 0.887,
    per_metric: {
      revenue: 1.0,
      total_assets: 1.0,
      operating_cash_flow: 1.0,
      diluted_eps: 1.0,
      gross_profit: 0.875,
      shareholders_equity: 0.875,
      net_income: 0.75,
      total_liabilities: 0.625
    },
    per_company: {
      MSFT: 1.0,
      NKE: 0.75,
      AAPL: 1.0,
      PEP: 0.75,
      AMZN: 0.875,
      JNJ: 1.0,
      KO: 0.75,
      GOOGL: 1.0
    }
  },
  confusion: {
    approved_correct: 55,
    approved_wrong: 7,
    escalated_wrong: 0,
    escalated_correct: 0
  },
  escalation_precision: {
    lenient: 0.89,
    strict: 1.0
  },
  calibration: [
    { bucket: "0.9-1.0", n: 51, accuracy: 0.94 },
    { bucket: "0.8-0.9", n: 3, accuracy: 0.0 },
    { bucket: "0.6-0.7", n: 1, accuracy: 1.0 },
    { bucket: "0.0-0.5", n: 9, accuracy: 0.89 }
  ],
  reliability: {
    unique_llm_calls: 11,
    duplicate_llm_calls: 0,
    audit_rows: 11,
    chain_ok: true,
    kill_resume_tests: { passed: 10, total: 10 }
  },
  split: {
    natural: { accuracy_raw: 0.891, escalated: 13 },
    fault_injected: { accuracy_raw: 0.0, escalated: 0 }
  },
  config_snapshot: {
    confidence_threshold: 0.75,
    yoy_threshold_pct: 50.0,
    equation_tolerance_pct: 0.5,
    disagree_cap: 0.4,
    scoring_weights: { agree: 0.5, label: 0.3, cross: 0.2 },
    max_review_rounds: 2,
    llm: { concurrency: 3, model: "openai/gpt-oss-120b" },
    edgar: { max_rps: 5.0, user_agent: "FilingAuditor your_real_email@example.com" }
  }
};

export const MOCK_METRICS_GRID = [
  {
    company: "Apple Inc.",
    ticker: "AAPL",
    revenue: { value: 478834000000, confidence: 0.90, status: "auto_approved" },
    net_income: { value: 132175000000, confidence: 0.90, status: "auto_approved" },
    total_assets: { value: 404548000000, confidence: 0.90, status: "auto_approved" },
    total_liabilities: { value: 292455000000, confidence: 0.90, status: "auto_approved" },
    shareholders_equity: { value: 112093000000, confidence: 0.90, status: "approved" },
    operating_cash_flow: { value: 145097000000, confidence: 0.90, status: "auto_approved" },
    gross_profit: { value: 233602000000, confidence: 0.90, status: "auto_approved" },
    diluted_eps: { value: 8.98, confidence: 0.90, status: "auto_approved" }
  },
  {
    company: "Microsoft Corporation",
    ticker: "MSFT",
    revenue: { value: 331839000000, confidence: 0.90, status: "auto_approved" },
    net_income: { value: 133749000000, confidence: 0.90, status: "auto_approved" },
    total_assets: { value: 758376000000, confidence: 0.90, status: "auto_approved" },
    total_liabilities: { value: 315989000000, confidence: 0.90, status: "auto_approved" },
    shareholders_equity: { value: 442387000000, confidence: 0.90, status: "auto_approved" },
    operating_cash_flow: { value: 182935000000, confidence: 0.90, status: "auto_approved" },
    gross_profit: { value: 225465000000, confidence: 0.65, status: "approved" },
    diluted_eps: { value: 17.95, confidence: 0.90, status: "auto_approved" }
  },
  {
    company: "The Coca-Cola Company",
    ticker: "KO",
    revenue: { value: 47941000000, confidence: 0.90, status: "auto_approved" },
    net_income: { value: 13137000000, confidence: 0.90, status: "auto_approved" },
    total_assets: { value: 104816000000, confidence: 0.90, status: "auto_approved" },
    total_liabilities: { value: 72647000000, confidence: 0.85, status: "auto_approved" },
    shareholders_equity: { value: 32169000000, confidence: 0.90, status: "auto_approved" },
    operating_cash_flow: { value: 7408000000, confidence: 0.90, status: "auto_approved" },
    gross_profit: { value: 29544000000, confidence: 0.90, status: "auto_approved" },
    diluted_eps: { value: 3.04, confidence: 0.90, status: "auto_approved" }
  }
];

// Scripted Mock Event Emitter
export class MockEventEmitter {
  private listeners: ((event: any) => void)[] = [];
  private timer: any = null;

  subscribe(listener: (event: any) => void) {
    this.listeners.push(listener);
    if (!this.timer) {
      this.startScriptedSequence();
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: any) {
    this.listeners.forEach((l) => l(event));
  }

  private startScriptedSequence() {
    let step = 0;
    const script = [
      { seq: 413, ts: new Date().toISOString(), run_id: "r_8f3a", type: "node_started", payload: { node: "human_review" } },
      { seq: 414, ts: new Date().toISOString(), run_id: "r_8f3a", type: "run_paused", payload: { node: "human_review", review_id: "rv_12" } },
      { seq: 415, ts: new Date().toISOString(), run_id: "r_8f3a", type: "review_decided", payload: { review_id: "rv_12", decision: "approve", audit_seq: 9 } },
      { seq: 416, ts: new Date().toISOString(), run_id: "r_8f3a", type: "run_resumed", payload: { from_checkpoint: true } },
      { seq: 417, ts: new Date().toISOString(), run_id: "r_8f3a", type: "system_recovered", payload: { resumed_runs: ["r_8f3a"], replayed_decisions: ["rv_12"] } }
    ];

    this.timer = setInterval(() => {
      if (step < script.length) {
        this.emit(script[step]);
        step++;
      } else {
        clearInterval(this.timer);
      }
    }, 4000);
  }
}

export const mockEventEmitter = new MockEventEmitter();
