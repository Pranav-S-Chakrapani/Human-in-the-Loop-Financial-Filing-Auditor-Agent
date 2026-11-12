import pytest
from fastapi.testclient import TestClient

from backend.app.api.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_get_companies(client):
    res = client.get("/companies")
    assert res.status_code == 200
    data = res.json()
    assert "pinned" in data
    assert "AAPL" in data["pinned"]
    assert "MSFT" in data["pinned"]

def test_add_company_nonexistent_ticker(client):
    res = client.post("/companies", json={"ticker": "XYZNONEXISTENT999"})
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

def test_add_company_valid_nvda(client):
    res = client.post("/companies", json={"ticker": "NVDA"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["ticker"] == "NVDA"
    assert "cik" in data["company"]
    assert "0001045810" in data["company"]["cik"]

    # Verify listed in GET /companies
    res_list = client.get("/companies")
    custom_tickers = [c["ticker"] for c in res_list.json()["custom"]]
    assert "NVDA" in custom_tickers
