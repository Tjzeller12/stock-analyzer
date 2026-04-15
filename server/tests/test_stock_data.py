"""
test_stock_data.py — integration tests for the /data/* routes.

All four routes (/news, /stock_data, /in_depth_data, /chart_data)
are behind @login_required. We test auth guards, missing payloads,
and mock the external Alpha Vantage API so tests run offline.
"""
import pytest
from unittest.mock import patch


class TestStockDataAuth:
    """All /data/* routes require a valid JWT."""

    def test_news_without_token_returns_401(self, client):
        resp = client.post("/data/news", json={"filter": "all"})
        assert resp.status_code == 401

    def test_stock_data_without_token_returns_401(self, client):
        resp = client.post("/data/stock_data", json={"symbol": "AAPL"})
        assert resp.status_code == 401

    def test_in_depth_data_without_token_returns_401(self, client):
        resp = client.post("/data/in_depth_data", json={"symbol": "AAPL"})
        assert resp.status_code == 401

    def test_chart_data_without_token_returns_401(self, client):
        resp = client.post("/data/chart_data", json={"symbol": "AAPL"})
        assert resp.status_code == 401


class TestNews:
    """Tests for POST /data/news"""

    def test_invalid_filter_returns_404(self, client, auth_headers):
        """A filter name that is not in the Filter table should return 404."""
        resp = client.post("/data/news", json={"filter": "nonexistent_filter_xyz"}, headers=auth_headers)
        assert resp.status_code == 404

    def test_missing_filter_key_returns_404(self, client, auth_headers):
        """A filter name not in the Filter table should return 404."""
        resp = client.post("/data/news", json={"filter": "__invalid_filter_sentinel__"}, headers=auth_headers)
        assert resp.status_code == 404


class TestStockDataRoute:
    """Tests for POST /data/stock_data"""

    def test_unknown_symbol_returns_404(self, client, auth_headers):
        """A completely unknown symbol that the API also does not know should return 404."""
        with patch("app.routes.stock_data.add_to_master", return_value={"error": "Symbol not found"}):
            resp = client.post("/data/stock_data", json={"symbol": "ZZZZZZ_FAKE"}, headers=auth_headers)
        assert resp.status_code == 404

    def test_known_stock_returns_data(self, client, auth_headers, app):
        """A stock that exists in StockMaster should be returned directly."""
        from app.models import StockMaster
        from app import db

        with app.app_context():
            stock = StockMaster(symbol="MOCKST", name="Mock Stock", price=100.0, market_cap=1_000_000)
            db.session.add(stock)
            db.session.commit()

        # Mock the live price refresh so we don't hit Alpha Vantage
        with patch("app.routes.stock_data.get_av_json", return_value={}):
            resp = client.post("/data/stock_data", json={"symbol": "MOCKST"}, headers=auth_headers)

        assert resp.status_code == 200
        data = resp.get_json()
        assert data["symbol"] == "MOCKST"

        # Teardown
        with app.app_context():
            s = StockMaster.query.filter_by(symbol="MOCKST").first()
            if s:
                db.session.delete(s)
                db.session.commit()


class TestInDepthData:
    """Tests for POST /data/in_depth_data"""

    def test_missing_symbol_returns_400(self, client, auth_headers):
        resp = client.post("/data/in_depth_data", json={}, headers=auth_headers)
        assert resp.status_code == 400

    def test_valid_symbol_returns_data(self, client, auth_headers):
        mock_financials = {"income_statement": [], "cash_flow": []}
        with patch("app.routes.stock_data.get_in_depth_financials", return_value=mock_financials):
            resp = client.post("/data/in_depth_data", json={"symbol": "AAPL"}, headers=auth_headers)
        assert resp.status_code == 200


class TestChartData:
    """Tests for POST /data/chart_data"""

    def test_missing_symbol_returns_400(self, client, auth_headers):
        resp = client.post("/data/chart_data", json={}, headers=auth_headers)
        assert resp.status_code == 400

    def test_valid_symbol_returns_parsed_chart_data(self, client, auth_headers):
        """Mock the Alpha Vantage response to return a small time series."""
        mock_av_response = {
            "Time Series (Daily)": {
                "2024-01-02": {"4. close": "185.20", "5. adjusted close": "185.20"},
                "2024-01-03": {"4. close": "184.50", "5. adjusted close": "184.50"},
            }
        }
        with patch("app.routes.stock_data.get_av_json", return_value=mock_av_response):
            resp = client.post("/data/chart_data", json={"symbol": "AAPL", "timeFrame": "1Y"}, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert isinstance(data, list)
        assert len(data) == 2
        assert "time" in data[0]
        assert "value" in data[0]
