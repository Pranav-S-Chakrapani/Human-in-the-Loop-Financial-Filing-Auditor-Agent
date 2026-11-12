import {
  MOCK_HEALTH,
  MOCK_COUNTERS,
  MOCK_RUNS,
  MOCK_REVIEWS,
  MOCK_REVIEW_DETAIL,
  MOCK_AUDIT,
  MOCK_REPORT,
  MOCK_METRICS_GRID,
  mockEventEmitter
} from './mocks';

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const BASE_URL = 'http://localhost:8000';

export async function fetchHealth() {
  if (USE_MOCKS) return MOCK_HEALTH;
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

export async function fetchCounters() {
  if (USE_MOCKS) return MOCK_COUNTERS;
  const res = await fetch(`${BASE_URL}/counters`);
  return res.json();
}

export async function fetchRuns() {
  if (USE_MOCKS) return MOCK_RUNS;
  const res = await fetch(`${BASE_URL}/runs`);
  return res.json();
}

export async function fetchRunDetail(runId: string) {
  if (USE_MOCKS) {
    const run = MOCK_RUNS.find((r) => r.run_id === runId) || MOCK_RUNS[0];
    return run;
  }
  const res = await fetch(`${BASE_URL}/runs/${runId}`);
  return res.json();
}

export async function createRun(companies: string[], faultMode?: string | null) {
  if (USE_MOCKS) {
    return { runs: companies.map((c) => ({ run_id: `r_mock_${c.toLowerCase()}`, ticker: c, status: 'queued' })) };
  }
  const res = await fetch(`${BASE_URL}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companies, fault_mode: faultMode || null })
  });
  return res.json();
}

export async function fetchReviews(status = 'all') {
  if (USE_MOCKS) {
    if (status === 'all') return MOCK_REVIEWS;
    return MOCK_REVIEWS.filter((r) => r.status === status);
  }
  const res = await fetch(`${BASE_URL}/reviews?status=${status}`);
  return res.json();
}

export async function fetchReviewDetail(reviewId: string) {
  if (USE_MOCKS) {
    return MOCK_REVIEW_DETAIL[reviewId] || MOCK_REVIEW_DETAIL['rv_12'];
  }
  const res = await fetch(`${BASE_URL}/reviews/${reviewId}`);
  return res.json();
}

export async function postReviewDecision(reviewId: string, payload: { decision: string; corrected_value?: number | null; reviewer: string; note: string }) {
  if (USE_MOCKS) {
    return {
      review_id: reviewId,
      decision: payload.decision,
      audit_seq: 12,
      audit_hash: "mock_hash_123456",
      run_status: "running",
      duplicate: false
    };
  }
  const res = await fetch(`${BASE_URL}/reviews/${reviewId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function fetchAudit() {
  if (USE_MOCKS) return MOCK_AUDIT;
  const res = await fetch(`${BASE_URL}/audit`);
  return res.json();
}

export async function verifyAuditChain() {
  if (USE_MOCKS) return { ok: true, rows: MOCK_AUDIT.length, head_hash: MOCK_AUDIT[MOCK_AUDIT.length - 1].row_hash, first_bad_seq: null };
  const res = await fetch(`${BASE_URL}/audit/verify`);
  return res.json();
}

export async function tamperAuditLog() {
  if (USE_MOCKS) {
    return {
      update_blocked: true,
      delete_blocked: true,
      errors: ["audit_log is append-only", "audit_log is append-only"]
    };
  }
  const res = await fetch(`${BASE_URL}/admin/tamper`, { method: 'POST' });
  return res.json();
}

export async function fetchReport() {
  if (USE_MOCKS) return MOCK_REPORT;
  const res = await fetch(`${BASE_URL}/report`);
  return res.json();
}

export async function fetchMetricsGrid() {
  if (USE_MOCKS) return MOCK_METRICS_GRID;
  // If real, query runs and their metrics
  const runs = await fetchRuns();
  const grid = [];
  for (const r of runs) {
    const detail = await fetchRunDetail(r.run_id);
    const metricMap: Record<string, any> = { company: r.company, ticker: r.ticker };
    if (detail.metrics) {
      for (const m of detail.metrics) {
        metricMap[m.metric] = {
          value: m.final_value ?? m.value_dollars,
          confidence: m.confidence,
          status: m.decision_status
        };
      }
    }
    grid.push(metricMap);
  }
  return grid.length > 0 ? grid : MOCK_METRICS_GRID;
}

export async function fetchConfig() {
  if (USE_MOCKS) return MOCK_REPORT.config_snapshot;
  const res = await fetch(`${BASE_URL}/config`);
  return res.json();
}

// WebSocket / Event listener connection with auto-reconnect and since_seq replay
let lastSeenSeq = 0;

export function subscribeToEvents(onEvent: (event: any) => void): () => void {
  if (USE_MOCKS) {
    return mockEventEmitter.subscribe((ev) => {
      if (ev.seq && ev.seq > lastSeenSeq) lastSeenSeq = ev.seq;
      onEvent(ev);
    });
  }

  let ws: WebSocket | null = null;
  let isClosedManually = false;
  let reconnectTimer: any = null;

  const connect = () => {
    if (isClosedManually) return;
    const url = `ws://localhost:8000/ws/events?since_seq=${lastSeenSeq}`;
    ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.seq && data.seq > lastSeenSeq) {
          lastSeenSeq = data.seq;
        }
        onEvent(data);
      } catch (e) {
        console.error("WS error parsing event", e);
      }
    };

    ws.onclose = () => {
      if (!isClosedManually) {
        reconnectTimer = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  connect();

  return () => {
    isClosedManually = true;
    clearTimeout(reconnectTimer);
    ws?.close();
  };
}
