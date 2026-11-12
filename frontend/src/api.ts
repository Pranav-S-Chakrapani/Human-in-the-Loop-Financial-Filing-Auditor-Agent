import { MOCK_HEALTH, MOCK_COUNTERS, MOCK_RUNS, MOCK_REVIEWS, MOCK_AUDIT } from './mocks';

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

export async function fetchReviews(status = 'all') {
  if (USE_MOCKS) return MOCK_REVIEWS;
  const res = await fetch(`${BASE_URL}/reviews?status=${status}`);
  return res.json();
}

export async function fetchAudit() {
  if (USE_MOCKS) return MOCK_AUDIT;
  const res = await fetch(`${BASE_URL}/audit`);
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch(`${BASE_URL}/config`);
  return res.json();
}
