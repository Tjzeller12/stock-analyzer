"""
test_radar.py — integration tests for the /radar/* routes.

Both routes require a stock to exist in StockMaster. For the
"not found" cases we just call with a symbol that was never added.
For success cases we insert a minimal StockMaster row into the
in-memory DB, then mock the score engine to avoid needing
MarketStats rows.
"""
import pytest
from unittest.mock import patch
from app import db
from app.models import StockMaster


@pytest.fixture
def sample_stock(app):
    """Insert a minimal StockMaster row and clean it up after the test."""
    with app.app_context():
        stock = StockMaster(symbol="TESTCO", name="Test Company", pe_ratio=20.0, roe=0.15)
        db.session.add(stock)
        db.session.commit()
        yield stock
        db.session.delete(stock)
        db.session.commit()


MOCK_TEMPLATE = {
    "name": "Test",
    "normalization_method": "min-max",
    "scope": "global",
    "equations": {"Valuation": "pe_ratio"}
}

MOCK_SCORES = {"Valuation": 55.0}


class TestSingleRadar:
    """Tests for POST /radar/single"""

    def test_missing_data_returns_400(self, client):
        resp = client.post("/radar/single", json={})
        assert resp.status_code == 400

    def test_missing_template_returns_400(self, client):
        resp = client.post("/radar/single", json={"symbol": "AAPL"})
        assert resp.status_code == 400

    def test_unknown_symbol_returns_404(self, client):
        resp = client.post("/radar/single", json={
            "symbol": "ZZZZZZ_UNKNOWN",
            "template": MOCK_TEMPLATE
        })
        assert resp.status_code == 404

    def test_valid_stock_returns_scores(self, client, sample_stock):
        with patch("app.routes.radar.calculate_single_stock_scores", return_value=MOCK_SCORES):
            resp = client.post("/radar/single", json={
                "symbol": "TESTCO",
                "template": MOCK_TEMPLATE
            })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["symbol"] == "TESTCO"
        assert "scores" in data


class TestCompareRadar:
    """Tests for POST /radar/compare"""

    def test_missing_symbols_returns_400(self, client):
        resp = client.post("/radar/compare", json={"template": MOCK_TEMPLATE})
        assert resp.status_code == 400

    def test_empty_symbols_list_returns_400(self, client):
        resp = client.post("/radar/compare", json={"symbols": [], "template": MOCK_TEMPLATE})
        assert resp.status_code == 400

    def test_missing_template_returns_400(self, client):
        resp = client.post("/radar/compare", json={"symbols": ["AAPL"]})
        assert resp.status_code == 400

    def test_unknown_symbols_returns_404(self, client):
        resp = client.post("/radar/compare", json={
            "symbols": ["ZZZZ_UNKNOWN1", "ZZZZ_UNKNOWN2"],
            "template": MOCK_TEMPLATE
        })
        assert resp.status_code == 404

    def test_valid_stocks_return_scores(self, client, sample_stock):
        mock_compare_scores = {"TESTCO": MOCK_SCORES}
        with patch("app.routes.radar.calculate_compare_scores", return_value=mock_compare_scores):
            resp = client.post("/radar/compare", json={
                "symbols": ["TESTCO"],
                "template": MOCK_TEMPLATE
            })
        assert resp.status_code == 200
        assert "scores" in resp.get_json()
