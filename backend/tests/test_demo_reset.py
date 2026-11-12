import os
import pytest
from fastapi.testclient import TestClient

from backend.app.api.main import app
from backend.app.db import get_connection

@pytest.fixture
def client():
    return TestClient(app)

def test_demo_reset_forbidden_by_default(client):
    # Ensure DEMO_RESET_ENABLED is not set
    if "DEMO_RESET_ENABLED" in os.environ:
        del os.environ["DEMO_RESET_ENABLED"]

    res = client.get("/dev/status")
    assert res.status_code == 200
    assert res.json()["demo_reset_enabled"] is False

    res_post = client.post("/dev/reset-demo")
    assert res_post.status_code == 403
    assert "disabled" in res_post.json()["detail"].lower()

def test_demo_reset_clears_data_when_enabled(client):
    os.environ["DEMO_RESET_ENABLED"] = "true"
    try:
        res = client.get("/dev/status")
        assert res.json()["demo_reset_enabled"] is True

        # Insert dummy row in runs and events
        conn = get_connection()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO runs (run_id, ticker, company, status, created_at, updated_at) VALUES ('r_test_dev', 'AAPL', 'Apple Inc.', 'completed', '2026-11-12T00:00:00Z', '2026-11-12T00:00:00Z')"
            )
            conn.execute(
                "INSERT INTO events (run_id, ts, type, payload) VALUES ('r_test_dev', '2026-11-12T00:00:00Z', 'test_event', '{}')"
            )
            conn.commit()
        finally:
            conn.close()

        # Call reset endpoint
        res_reset = client.post("/dev/reset-demo")
        assert res_reset.status_code == 200
        assert res_reset.json()["status"] == "success"

        # Verify DB is empty
        conn2 = get_connection()
        try:
            runs_count = conn2.execute("SELECT count(*) as c FROM runs").fetchone()["c"]
            events_count = conn2.execute("SELECT count(*) as c FROM events").fetchone()["c"]
            audit_count = conn2.execute("SELECT count(*) as c FROM audit_log").fetchone()["c"]
            assert runs_count == 0
            assert events_count == 0
            assert audit_count == 0
        finally:
            conn2.close()
    finally:
        del os.environ["DEMO_RESET_ENABLED"]
