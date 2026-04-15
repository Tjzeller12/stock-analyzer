"""
test_alphabot.py — integration tests for the /alphaBot/* routes.

All Anthropic/LLM calls and MCP tool calls are mocked via
`unittest.mock.patch` so no API keys or network access are needed.
"""
import pytest
from unittest.mock import patch


MOCK_LLM_RESPONSE = "This is a mocked AlphaBot analysis response."


class TestAlphaBotHealth:
    """Basic health check route."""

    def test_alphabot_root_returns_200(self, client):
        resp = client.post("/alphaBot")
        assert resp.status_code == 200
        assert "message" in resp.get_json()


class TestInDepthAnalysis:
    """Tests for POST /alphaBot/in_depth_analysis"""

    def test_missing_symbol_returns_400(self, client):
        resp = client.post("/alphaBot/in_depth_analysis", json={})
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_valid_symbol_returns_analysis(self, client):
        """Mock the LLM call so we don't need real API keys."""
        with patch("app.alphaBot.asyncio.run", return_value=MOCK_LLM_RESPONSE), \
             patch("app.alphaBot.get_prompt", return_value="Analyze {stock_symbol}"):
            resp = client.post("/alphaBot/in_depth_analysis", json={"stock_symbol": "AAPL"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert "response" in data
        assert data["response"] == MOCK_LLM_RESPONSE

    def test_missing_prompt_file_returns_404(self, client):
        """If the prompt file is missing, the route should return 404."""
        from app import cache
        cache.clear() # Clear cache to ensure we don't return a cached 200
        
        with patch("app.alphaBot.get_prompt", return_value=None):
            resp = client.post("/alphaBot/in_depth_analysis", json={"stock_symbol": "AAPL"})
        assert resp.status_code == 404


class TestCompareAnalysis:
    """Tests for POST /alphaBot/compare_analysis"""

    def test_missing_symbols_returns_400(self, client):
        resp = client.post("/alphaBot/compare_analysis", json={"equations": {}})
        assert resp.status_code == 400

    def test_valid_payload_returns_analysis(self, client):
        with patch("app.alphaBot.asyncio.run", return_value=MOCK_LLM_RESPONSE), \
             patch("app.alphaBot.get_prompt", return_value="Compare {stock_symbols}"):
            resp = client.post("/alphaBot/compare_analysis", json={
                "stock_symbols": ["AAPL", "TSLA"],
                "equations": {},
                "scores": {}
            })
        assert resp.status_code == 200
        assert resp.get_json()["response"] == MOCK_LLM_RESPONSE


class TestUserQuery:
    """Tests for POST /alphaBot/user_query"""

    def test_missing_query_returns_400(self, client):
        resp = client.post("/alphaBot/user_query", json={"stock_symbol": "AAPL"})
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_valid_query_returns_response(self, client):
        with patch("app.alphaBot.asyncio.run", return_value=MOCK_LLM_RESPONSE), \
             patch("app.alphaBot.get_prompt", return_value="Query {stock_symbol}: {user_query}"):
            resp = client.post("/alphaBot/user_query", json={
                "stock_symbol": "AAPL",
                "user_query": "What is the P/E ratio?"
            })
        assert resp.status_code == 200
        assert resp.get_json()["response"] == MOCK_LLM_RESPONSE


class TestEventPulse:
    """Tests for POST /alphaBot/event_pulse"""

    def test_missing_symbol_and_timestamp_returns_400(self, client):
        resp = client.post("/alphaBot/event_pulse", json={})
        assert resp.status_code == 400

    def test_missing_timestamp_returns_400(self, client):
        resp = client.post("/alphaBot/event_pulse", json={"stock_symbol": "AAPL"})
        assert resp.status_code == 400

    def test_valid_event_pulse_returns_response(self, client):
        with patch("app.alphaBot.asyncio.run", return_value=MOCK_LLM_RESPONSE), \
             patch("app.alphaBot.get_prompt", return_value="Event pulse for {stock_symbol} at {timestamp} date:{date_str} price:{price} swing:{swing_type} start:{start_date_str} startprice:{start_price}"):
            resp = client.post("/alphaBot/event_pulse", json={
                "stock_symbol": "AAPL",
                "timestamp": 1700000000,
                "date_str": "2023-11-14",
                "price": 187.44,
                "swing_type": "rally"
            })
        assert resp.status_code == 200
        assert resp.get_json()["response"] == MOCK_LLM_RESPONSE
