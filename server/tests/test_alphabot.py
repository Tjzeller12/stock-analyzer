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

    def test_missing_symbol_returns_400(self, client, auth_headers):
        resp = client.post("/alphaBot/in_depth_analysis", json={}, headers=auth_headers)
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_valid_symbol_returns_analysis(self, client, auth_headers):
        """Mock the LLM call so we don't need real API keys."""
        with patch("app.alphaBot.client.asyncio.run", return_value=MOCK_LLM_RESPONSE), \
             patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "Analyze AAPL"
            resp = client.post("/alphaBot/in_depth_analysis", json={"stock_symbol": "AAPL"}, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "response" in data
        assert data["response"] == MOCK_LLM_RESPONSE

    def test_missing_prompt_file_returns_404(self, client, auth_headers):
        """If the prompt file is missing, the route should return 404."""
        from app import cache
        from app.alphaBot.prompt import PromptNotFoundError
        cache.clear()  # Clear cache to ensure we don't return a cached 200

        with patch("app.alphaBot.blueprint.PromptTemplate.load", side_effect=PromptNotFoundError):
            resp = client.post("/alphaBot/in_depth_analysis", json={"stock_symbol": "AAPL"}, headers=auth_headers)
        assert resp.status_code == 404


class TestCompareAnalysis:
    """Tests for POST /alphaBot/compare_analysis"""

    def test_missing_symbols_returns_400(self, client, auth_headers):
        resp = client.post("/alphaBot/compare_analysis", json={"equations": {}}, headers=auth_headers)
        assert resp.status_code == 400

    def test_valid_payload_returns_analysis(self, client, auth_headers):
        with patch("app.alphaBot.client.asyncio.run", return_value=MOCK_LLM_RESPONSE), \
             patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "Compare AAPL, TSLA"
            resp = client.post("/alphaBot/compare_analysis", json={
                "stock_symbols": ["AAPL", "TSLA"],
                "equations": {},
                "scores": {}
            }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["response"] == MOCK_LLM_RESPONSE


class TestUserQuery:
    """Tests for POST /alphaBot/user_query"""

    def test_missing_query_returns_400(self, client, auth_headers):
        resp = client.post("/alphaBot/user_query", json={"stock_symbol": "AAPL"}, headers=auth_headers)
        assert resp.status_code == 400
        assert "error" in resp.get_json()

    def test_valid_query_returns_response(self, client, auth_headers):
        with patch("app.alphaBot.client.asyncio.run", return_value=MOCK_LLM_RESPONSE), \
             patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "Query AAPL: What is the P/E ratio?"
            resp = client.post("/alphaBot/user_query", json={
                "stock_symbol": "AAPL",
                "user_query": "What is the P/E ratio?"
            }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["response"] == MOCK_LLM_RESPONSE


class TestEventPulse:
    """Tests for POST /alphaBot/event_pulse"""

    def test_missing_symbol_and_timestamp_returns_400(self, client, auth_headers):
        resp = client.post("/alphaBot/event_pulse", json={}, headers=auth_headers)
        assert resp.status_code == 400

    def test_missing_timestamp_returns_400(self, client, auth_headers):
        resp = client.post("/alphaBot/event_pulse", json={"stock_symbol": "AAPL"}, headers=auth_headers)
        assert resp.status_code == 400

    def test_valid_event_pulse_returns_response(self, client, auth_headers):
        with patch("app.alphaBot.client.asyncio.run", return_value=MOCK_LLM_RESPONSE), \
             patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "Event pulse for AAPL at 1700000000"
            resp = client.post("/alphaBot/event_pulse", json={
                "stock_symbol": "AAPL",
                "timestamp": 1700000000,
                "date_str": "2023-11-14",
                "price": 187.44,
                "swing_type": "rally"
            }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.get_json()["response"] == MOCK_LLM_RESPONSE
