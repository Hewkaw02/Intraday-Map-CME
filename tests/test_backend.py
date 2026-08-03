import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.adapters.cme_adapter import CmeAdapter

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"

def test_symbols():
    response = client.get("/api/symbols")
    assert response.status_code == 200
    data = response.json()
    assert "symbols" in data
    assert "GC" in data["symbols"]
    assert "NQ" in data["symbols"]
    assert "ES" in data["symbols"]

def test_cme_adapter_loading():
    adapter = CmeAdapter()
    symbols_data = adapter.load_all_symbols()
    assert len(symbols_data) > 0
    assert "GC" in symbols_data
    gc = symbols_data["GC"]
    assert gc.symbol == "GC"
    assert gc.futurePrice > 0
    assert len(gc.standardDeviations) > 0
    assert len(gc.strikeData) > 0

def test_intraday_endpoint():
    response = client.get("/api/intraday/GC")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "GC"
    assert "data" in data
    assert data["data"]["futurePrice"] > 0

def test_price_endpoint():
    response = client.get("/api/price/GC")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "GC"
    assert "candles" in data
    assert len(data["candles"]) > 0

def test_status_endpoint():
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
