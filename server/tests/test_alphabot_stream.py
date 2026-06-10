"""
test_alphabot_stream.py — tests for the AlphaBot streaming layer.

Covers:
  - StreamEvent dataclass (to_sse encoding, factory methods)
  - _describe_tools() (human-readable tool messages)
  - _word_chunks() (simulated streaming helper)
  - AlphaBotStreamer.stream_sync() (thread bridge — mocked)
  - SSE streaming endpoints (/alphaBot/*/stream)
    - auth guard
    - input validation
    - SSE mimetype and event format
    - chunk + done events in the response
    - cached replay produces chunk + done events
"""
import json
import pytest
from unittest.mock import patch, MagicMock

from app.alphaBot.client import (
    StreamEvent,
    AlphaBotStreamer,
    _describe_tools,
    _word_chunks,
)


# ------------------------------------------------------------------ #
# StreamEvent unit tests                                               #
# ------------------------------------------------------------------ #

class TestStreamEvent:

    def test_chunk_factory(self):
        e = StreamEvent.chunk("hello world")
        assert e.type == "chunk"
        assert e.text == "hello world"

    def test_tool_running_factory(self):
        e = StreamEvent.tool_running(3, message="Grabbing news sentiment…")
        assert e.type == "tool_running"
        assert e.count == 3
        assert e.message == "Grabbing news sentiment…"

    def test_done_factory(self):
        e = StreamEvent.done()
        assert e.type == "done"

    def test_error_factory(self):
        e = StreamEvent.error("Something went wrong")
        assert e.type == "error"
        assert e.message == "Something went wrong"

    def test_to_sse_format(self):
        """SSE line must start with 'data: ' and end with double newline."""
        sse = StreamEvent.chunk("hello").to_sse()
        assert sse.startswith("data: ")
        assert sse.endswith("\n\n")

    def test_to_sse_json_parseable(self):
        sse = StreamEvent.tool_running(2, message="Grabbing price history…").to_sse()
        payload = json.loads(sse.removeprefix("data: ").strip())
        assert payload["type"] == "tool_running"
        assert payload["count"] == 2
        assert payload["message"] == "Grabbing price history…"

    def test_to_sse_omits_empty_fields(self):
        """Fields with falsy values should be omitted from the SSE payload."""
        sse = StreamEvent.done().to_sse()
        payload = json.loads(sse.removeprefix("data: ").strip())
        assert "text" not in payload
        assert "count" not in payload
        assert "message" not in payload


# ------------------------------------------------------------------ #
# _describe_tools unit tests                                           #
# ------------------------------------------------------------------ #

class TestDescribeTools:

    def _make_tool(self, name: str, input_dict: dict | None = None):
        t = MagicMock()
        t.type = "tool_use"
        t.name = name
        t.input = input_dict or {}
        return t

    def test_news_sentiment_label(self):
        tool = self._make_tool("TOOL_CALL", {"function_name": "NEWS_SENTIMENT"})
        assert _describe_tools([tool]) == "Grabbing news sentiment…"

    def test_global_quote_label(self):
        tool = self._make_tool("TOOL_CALL", {"function_name": "GLOBAL_QUOTE"})
        assert _describe_tools([tool]) == "Grabbing live price…"

    def test_balance_sheet_label(self):
        tool = self._make_tool("TOOL_CALL", {"function_name": "BALANCE_SHEET"})
        assert _describe_tools([tool]) == "Grabbing balance sheet…"

    def test_two_tools_joined_with_ampersand(self):
        tools = [
            self._make_tool("TOOL_CALL", {"function_name": "NEWS_SENTIMENT"}),
            self._make_tool("TOOL_CALL", {"function_name": "GLOBAL_QUOTE"}),
        ]
        result = _describe_tools(tools)
        assert "news sentiment" in result
        assert "live price" in result
        assert "&" in result

    def test_three_tools_comma_separated(self):
        tools = [
            self._make_tool("TOOL_CALL", {"function_name": "NEWS_SENTIMENT"}),
            self._make_tool("TOOL_CALL", {"function_name": "GLOBAL_QUOTE"}),
            self._make_tool("TOOL_CALL", {"function_name": "OVERVIEW"}),
        ]
        result = _describe_tools(tools)
        assert "," in result
        assert "&" in result

    def test_unknown_tool_falls_back_gracefully(self):
        tool = self._make_tool("MYSTERY_TOOL")
        result = _describe_tools([tool])
        assert "mystery tool" in result.lower()

    def test_empty_list_returns_default(self):
        assert _describe_tools([]) == "Gathering market data…"

    def test_duplicate_labels_deduplicated(self):
        """Two calls to the same function should produce one label."""
        tools = [
            self._make_tool("TOOL_CALL", {"function_name": "NEWS_SENTIMENT"}),
            self._make_tool("TOOL_CALL", {"function_name": "NEWS_SENTIMENT"}),
        ]
        result = _describe_tools(tools)
        assert result.count("news sentiment") == 1


# ------------------------------------------------------------------ #
# _word_chunks unit tests                                              #
# ------------------------------------------------------------------ #

class TestWordChunks:

    def test_short_text_single_chunk(self):
        chunks = _word_chunks("hello world", batch_size=10)
        assert len(chunks) == 1
        assert chunks[0] == "hello world"

    def test_batches_by_word_count(self):
        text = " ".join(str(i) for i in range(12))
        chunks = _word_chunks(text, batch_size=4)
        assert len(chunks) == 3  # 12 words / 4 per batch

    def test_spaces_between_batches(self):
        chunks = _word_chunks("a b c d e f", batch_size=3)
        # First chunk should end with a space (not the last one)
        assert chunks[0].endswith(" ")
        assert not chunks[-1].endswith(" ")

    def test_roundtrip_reconstructs_text(self):
        original = "The quick brown fox jumps over the lazy dog"
        chunks = _word_chunks(original, batch_size=3)
        assert "".join(chunks) == original


# ------------------------------------------------------------------ #
# SSE streaming endpoint integration tests                             #
# ------------------------------------------------------------------ #

MOCK_SSE_LINES = [
    'data: {"type": "tool_running", "count": 2, "message": "Grabbing news sentiment & live price..."}\n\n',
    'data: {"type": "chunk", "text": "Tesla experienced "}\n\n',
    'data: {"type": "chunk", "text": "a significant rally "}\n\n',
    'data: {"type": "chunk", "text": "driven by strong earnings."}\n\n',
    'data: {"type": "done"}\n\n',
]

MOCK_ANALYSIS_TEXT = "Tesla experienced a significant rally driven by strong earnings."


def _parse_sse(raw: bytes) -> list[dict]:
    """Parse SSE response body into a list of event payloads."""
    events = []
    for line in raw.decode().splitlines():
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                pass
    return events


class TestStreamingAuth:
    """All /stream endpoints require a valid JWT."""

    @pytest.mark.parametrize("url,body", [
        ("/alphaBot/in_depth_analysis/stream", {"stock_symbol": "AAPL"}),
        ("/alphaBot/user_query/stream", {"user_query": "What is P/E?", "stock_symbol": "AAPL"}),
        ("/alphaBot/event_pulse/stream", {"stock_symbol": "AAPL", "timestamp": 1700000000}),
        ("/alphaBot/compare_analysis/stream", {"stock_symbols": ["AAPL", "TSLA"]}),
    ])
    def test_returns_401_without_token(self, client, url, body):
        resp = client.post(url, json=body)
        assert resp.status_code == 401


class TestStreamingInputValidation:
    """Streaming endpoints must validate required fields before streaming."""

    def test_in_depth_missing_symbol_returns_400(self, client, auth_headers):
        resp = client.post("/alphaBot/in_depth_analysis/stream", json={}, headers=auth_headers)
        assert resp.status_code == 400

    def test_user_query_missing_query_returns_400(self, client, auth_headers):
        resp = client.post("/alphaBot/user_query/stream", json={"stock_symbol": "AAPL"}, headers=auth_headers)
        assert resp.status_code == 400

    def test_event_pulse_missing_timestamp_returns_400(self, client, auth_headers):
        resp = client.post(
            "/alphaBot/event_pulse/stream",
            json={"stock_symbol": "AAPL"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_compare_missing_symbols_returns_400(self, client, auth_headers):
        resp = client.post(
            "/alphaBot/compare_analysis/stream",
            json={"equations": {}, "scores": {}},
            headers=auth_headers,
        )
        assert resp.status_code == 400


class TestInDepthStream:
    """Tests for POST /alphaBot/in_depth_analysis/stream"""

    def test_returns_sse_content_type(self, client, auth_headers):
        with patch("app.alphaBot.blueprint.AlphaBotStreamer.stream_sync",
                   return_value=iter(MOCK_SSE_LINES)), \
             patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "Analyze AAPL"
            resp = client.post(
                "/alphaBot/in_depth_analysis/stream",
                json={"stock_symbol": "AAPL"},
                headers=auth_headers,
            )
        assert "text/event-stream" in resp.content_type

    def test_response_contains_chunk_and_done_events(self, client, auth_headers):
        with patch("app.alphaBot.blueprint.AlphaBotStreamer.stream_sync",
                   return_value=iter(MOCK_SSE_LINES)), \
             patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "Analyze AAPL"
            resp = client.post(
                "/alphaBot/in_depth_analysis/stream",
                json={"stock_symbol": "AAPL"},
                headers=auth_headers,
            )
        events = _parse_sse(resp.data)
        types = [e["type"] for e in events]
        assert "chunk" in types
        assert "done" in types

    def test_chunks_reconstruct_full_text(self, client, auth_headers):
        with patch("app.alphaBot.blueprint.AlphaBotStreamer.stream_sync",
                   return_value=iter(MOCK_SSE_LINES)), \
             patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "Analyze AAPL"
            resp = client.post(
                "/alphaBot/in_depth_analysis/stream",
                json={"stock_symbol": "AAPL"},
                headers=auth_headers,
            )
        events = _parse_sse(resp.data)
        full_text = "".join(e.get("text", "") for e in events if e["type"] == "chunk")
        assert full_text == MOCK_ANALYSIS_TEXT

    def test_cached_response_replayed_as_chunks(self, client, auth_headers, app):
        """A cached analysis should be streamed back as word chunks, not a JSON blob."""
        from app import cache

        with app.app_context():
            cache.set("in_depth_analysis:AAPL", MOCK_ANALYSIS_TEXT, timeout=900)

        with patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "Analyze AAPL"
            resp = client.post(
                "/alphaBot/in_depth_analysis/stream",
                json={"stock_symbol": "AAPL"},
                headers=auth_headers,
            )

        events = _parse_sse(resp.data)
        types = [e["type"] for e in events]
        assert "chunk" in types
        assert "done" in types
        # Must NOT have returned a plain JSON object
        assert "response" not in (resp.get_json() or {})

        with app.app_context():
            cache.delete("in_depth_analysis:AAPL")

    def test_missing_prompt_returns_404(self, client, auth_headers):
        from app.alphaBot.prompt import PromptNotFoundError
        with patch("app.alphaBot.blueprint.PromptTemplate.load",
                   side_effect=PromptNotFoundError):
            resp = client.post(
                "/alphaBot/in_depth_analysis/stream",
                json={"stock_symbol": "AAPL"},
                headers=auth_headers,
            )
        assert resp.status_code == 404


class TestEventPulseStream:
    """Tests for POST /alphaBot/event_pulse/stream"""

    def test_valid_payload_returns_sse(self, client, auth_headers):
        with patch("app.alphaBot.blueprint.AlphaBotStreamer.stream_sync",
                   return_value=iter(MOCK_SSE_LINES)), \
             patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "Event pulse AAPL"
            resp = client.post(
                "/alphaBot/event_pulse/stream",
                json={
                    "stock_symbol": "AAPL",
                    "timestamp": 1700000000,
                    "date_str": "2023-11-14",
                    "price": 187.44,
                    "swing_type": "Massive Rally",
                },
                headers=auth_headers,
            )
        assert "text/event-stream" in resp.content_type
        events = _parse_sse(resp.data)
        assert any(e["type"] == "tool_running" for e in events)
        assert any(e["type"] == "done" for e in events)


class TestUserQueryStream:
    """Tests for POST /alphaBot/user_query/stream"""

    def test_valid_query_returns_chunk_and_done(self, client, auth_headers):
        with patch("app.alphaBot.blueprint.AlphaBotStreamer.stream_sync",
                   return_value=iter(MOCK_SSE_LINES)), \
             patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "User query"
            resp = client.post(
                "/alphaBot/user_query/stream",
                json={"stock_symbol": "AAPL", "user_query": "What is the P/E ratio?"},
                headers=auth_headers,
            )
        events = _parse_sse(resp.data)
        types = [e["type"] for e in events]
        assert "chunk" in types
        assert "done" in types


class TestCompareStream:
    """Tests for POST /alphaBot/compare_analysis/stream"""

    def test_valid_payload_returns_sse(self, client, auth_headers):
        with patch("app.alphaBot.blueprint.AlphaBotStreamer.stream_sync",
                   return_value=iter(MOCK_SSE_LINES)), \
             patch("app.alphaBot.blueprint.PromptTemplate.load") as mock_load:
            mock_load.return_value.render.return_value = "Compare AAPL TSLA"
            resp = client.post(
                "/alphaBot/compare_analysis/stream",
                json={"stock_symbols": ["AAPL", "TSLA"], "equations": {}, "scores": {}},
                headers=auth_headers,
            )
        assert "text/event-stream" in resp.content_type
        events = _parse_sse(resp.data)
        assert any(e["type"] == "done" for e in events)
