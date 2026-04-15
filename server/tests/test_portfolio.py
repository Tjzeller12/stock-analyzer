"""
test_portfolio.py — integration tests for the /portfolio/* routes.

Tests focus on input validation and authentication guards.
No real AlphaVantage API calls are made — the add/refresh
routes that touch external services are tested only for their
auth guards and missing-payload guards.
"""
import pytest
from unittest.mock import patch


class TestPortfolioAuth:
    """Verify all portfolio routes require authentication."""

    def test_add_without_token_returns_401(self, client):
        resp = client.post("/portfolio/add", json={"symbol": "AAPL"})
        assert resp.status_code == 401

    def test_remove_without_token_returns_401(self, client):
        resp = client.post("/portfolio/remove", json={"symbol": "AAPL"})
        assert resp.status_code == 401

    def test_stocks_without_token_returns_401(self, client):
        resp = client.post("/portfolio/stocks", json={"sortBy": "symbol"})
        assert resp.status_code == 401

    def test_refresh_without_token_returns_401(self, client):
        resp = client.post("/portfolio/refresh", json={})
        assert resp.status_code == 401


class TestPortfolioAdd:
    """Tests for POST /portfolio/add"""

    def test_add_missing_symbol_returns_400(self, client, auth_headers):
        """Request with no symbol key should return 400."""
        resp = client.post("/portfolio/add", json={}, headers=auth_headers)
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_add_invalid_symbol_returns_400(self, client, auth_headers):
        """An invalid ticker symbol that the service rejects should return 400.
        We mock `add_stock` to simulate the service returning an error dict."""
        with patch("app.routes.portfolio.add_stock", return_value={"error": "Invalid symbol"}):
            resp = client.post("/portfolio/add", json={"symbol": "FAKEXYZ"}, headers=auth_headers)
        assert resp.status_code == 400
        data = resp.get_json()
        assert "error" in data


class TestPortfolioRemove:
    """Tests for POST /portfolio/remove"""

    def test_remove_missing_symbol_returns_400(self, client, auth_headers):
        """Request with no symbol key should return 400."""
        resp = client.post("/portfolio/remove", json={}, headers=auth_headers)
        assert resp.status_code == 400

    def test_remove_stock_not_in_portfolio_returns_404(self, client, auth_headers):
        """Trying to remove a stock the user never added should return 404."""
        resp = client.post("/portfolio/remove", json={"symbol": "AAPL"}, headers=auth_headers)
        assert resp.status_code == 404
        assert "error" in resp.get_json()


class TestPortfolioStocks:
    """Tests for POST /portfolio/stocks"""

    def test_stocks_returns_empty_list_when_portfolio_is_empty(self, client, auth_headers):
        """A freshly registered user should have an empty portfolio."""
        resp = client.post("/portfolio/stocks", json={"sortBy": "symbol"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_stocks_invalid_sort_field_returns_error(self, client, auth_headers):
        """An invalid sortBy field should return a JSON error, not a 500."""
        resp = client.post("/portfolio/stocks", json={"sortBy": "nonexistent_column"}, headers=auth_headers)
        data = resp.get_json()
        assert "error" in data
