"""
AlphaBot Flask Blueprint
------------------------
All HTTP routes live here.  Business logic (Claude calls, prompt loading,
analysis classes) is delegated to the other modules in this package.

The helper ``_run_cached`` centralises the cache-read → run → cache-write
pattern that every route shares, eliminating the repeated boilerplate.
"""
import hashlib
import json

from flask import Blueprint, Response, current_app, jsonify, request, stream_with_context

from app import cache
from app.alphaBot.client import AlphaBotClient, AlphaBotResult, AlphaBotStreamer, StreamEvent
from app.alphaBot.prompt import PromptNotFoundError, PromptTemplate
from app.constants import (
    COMPARE_PROMPT,
    EVENT_PULSE_PROMPT,
    IN_DEPTH_PROMPT,
    USER_QUERY_PROMPT,
)
from app.models import StockMaster
from app.routes.auth import login_required

alphaBot_bp = Blueprint("alphaBot", __name__)


# ------------------------------------------------------------------ #
# Shared helpers                                                       #
# ------------------------------------------------------------------ #

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def _run_cached(cache_key: str, prompt: str, include_tools: bool, ttl: int):
    """
    Check cache → run analysis → cache result if cacheable → return response.
    Always returns a Flask (response, status_code) tuple.
    """
    cached = cache.get(cache_key)
    if cached:
        return jsonify({"response": cached}), 200

    result = AlphaBotClient.run_sync(prompt, include_tools=include_tools)
    if result.cacheable:
        cache.set(cache_key, result.text, timeout=ttl)
    return jsonify({"response": result.text}), 200


def _stream_cached(cache_key: str, prompt: str, include_tools: bool, ttl: int) -> Response:
    """
    SSE streaming variant of ``_run_cached``.

    Cache hit  → stream the cached text as word-level chunks (smooth replay).
    Cache miss → stream live via AlphaBotStreamer; accumulate final text and
                 cache it once the ``done`` event is emitted.
    """
    cached = cache.get(cache_key)
    if cached:
        def _replay_cached() -> "Generator[str, None, None]":
            for chunk in _word_chunks_sse(cached):
                yield chunk
            yield StreamEvent.done().to_sse()

        return Response(
            stream_with_context(_replay_cached()),
            mimetype="text/event-stream",
            headers=_SSE_HEADERS,
        )

    accumulated: list[str] = []

    def _live_stream() -> "Generator[str, None, None]":
        for sse_line in AlphaBotStreamer.stream_sync(prompt, include_tools=include_tools):
            # Intercept chunk / done events for caching — transparent to client
            try:
                payload = json.loads(sse_line.removeprefix("data: ").rstrip())
                if payload.get("type") == "chunk":
                    accumulated.append(payload.get("text", ""))
                elif payload.get("type") == "done":
                    full_text = "".join(accumulated)
                    if AlphaBotResult(text=full_text).cacheable:
                        cache.set(cache_key, full_text, timeout=ttl)
            except Exception:
                pass
            yield sse_line

    return Response(
        stream_with_context(_live_stream()),
        mimetype="text/event-stream",
        headers=_SSE_HEADERS,
    )


def _word_chunks_sse(text: str, batch: int = 6) -> "Generator[str, None, None]":
    """Yield SSE chunk lines for ``text`` in small word batches."""
    words = text.split(" ")
    for i in range(0, len(words), batch):
        part = " ".join(words[i : i + batch])
        if i + batch < len(words):
            part += " "
        yield StreamEvent.chunk(part).to_sse()


# Type-hint import (only needed for annotations — avoids runtime overhead)
from typing import Generator  # noqa: E402


# ------------------------------------------------------------------ #
# Routes                                                               #
# ------------------------------------------------------------------ #

@alphaBot_bp.route("/alphaBot", methods=["POST"])
def alphaBot_endpoint():
    return jsonify({"message": "AlphaBot is running"}), 200


@alphaBot_bp.route("/alphaBot/in_depth_analysis", methods=["POST"])
def get_in_depth_analysis():
    data = request.json
    symbol = data.get("stock_symbol")
    if not symbol:
        return jsonify({"error": "Stock symbol is required"}), 400

    try:
        prompt = PromptTemplate.load(IN_DEPTH_PROMPT).render(stock_symbol=symbol)
    except PromptNotFoundError:
        return jsonify({"error": "Prompt not found"}), 404

    try:
        return _run_cached(f"in_depth_analysis:{symbol.upper()}", prompt, False, 900)
    except Exception as e:
        current_app.logger.error(f"Error in in_depth_analysis: {e}")
        return jsonify({"error": "Failed to generate in-depth analysis"}), 500


@alphaBot_bp.route("/alphaBot/compare_analysis", methods=["POST"])
def get_compare_analysis():
    data = request.json
    stock_symbols = data.get("stock_symbols")
    equations = data.get("equations", {})
    scores = data.get("scores", {})

    if not stock_symbols:
        return jsonify({"error": "Stock symbols are required"}), 400

    eq_hash = hashlib.md5(json.dumps(equations, sort_keys=True).encode()).hexdigest()
    symbols_key = "_".join(sorted(s.upper() for s in stock_symbols))
    cache_key = f"compare_analysis:{symbols_key}:{eq_hash}"

    try:
        prompt = PromptTemplate.load(COMPARE_PROMPT).render(
            stock_symbols=", ".join(stock_symbols)
        )
    except PromptNotFoundError:
        return jsonify({"error": "Prompt not found"}), 404

    market_context = "<market_data>\n"
    market_context += "=== USER'S CUSTOM ALGORITHMS ===\n"
    market_context += f"{json.dumps(equations, indent=2)}\n\n"
    market_context += "=== RESULTING SCORES (0-100, Higher is Better) ===\n"
    market_context += f"{json.dumps(scores, indent=2)}\n\n"

    for symbol in stock_symbols:
        stock = StockMaster.query.filter_by(symbol=symbol).first()
        if stock:
            stock_data = stock.to_dict()
            stock_data.pop("news_sentiment_data", None)
            stock_data.pop("income_statement", None)
            stock_data.pop("cash_flow_history", None)
            volume = stock.insider_volume or 0
            direction = (
                "NET BUYING (Positive Signal)" if volume > 0
                else "NET SELLING (Negative Signal)" if volume < 0
                else "NEUTRAL (No Signal / No Data)"
            )
            market_context += f"Data for {symbol}:\n"
            market_context += f"METRICS: {json.dumps(stock_data, default=str)}\n"
            market_context += f"INSIDER_TRANSACTION_VOLUME: {volume:,.0f} shares ({direction})\n---\n"
        else:
            market_context += f"Data for {symbol}: NOT FOUND IN CACHE\n---\n"

    market_context += "</market_data>\n\n"
    prompt = prompt + market_context

    try:
        return _run_cached(cache_key, prompt, False, 900)
    except Exception as e:
        current_app.logger.error(f"Error in compare_analysis: {e}")
        return jsonify({"error": "Failed to generate compare analysis"}), 500


@alphaBot_bp.route("/alphaBot/user_query", methods=["POST"])
def get_user_query():
    data = request.json
    user_query = data.get("user_query")
    stock_symbol = data.get("stock_symbol", "")
    if not user_query:
        return jsonify({"error": "User query is required"}), 400

    try:
        prompt = PromptTemplate.load(USER_QUERY_PROMPT).render(
            stock_symbol=stock_symbol,
            user_query=user_query,
        )
    except PromptNotFoundError:
        return jsonify({"error": "Prompt not found"}), 404

    try:
        result = AlphaBotClient.run_sync(prompt, include_tools=True)
        return jsonify({"response": result.text}), 200
    except Exception as e:
        current_app.logger.error(f"Error in user_query: {e}")
        return jsonify({"error": "Failed to generate response for user query"}), 500


@alphaBot_bp.route("/alphaBot/event_pulse", methods=["POST"])
def get_event_pulse_analysis():
    data = request.json
    stock_symbol = data.get("stock_symbol")
    timestamp = data.get("timestamp")
    if not stock_symbol or not timestamp:
        return jsonify({"error": "Stock symbol and timestamp are required"}), 400

    date_str = data.get("date_str", "")
    price = data.get("price", 0)
    swing_type = data.get("swing_type", "event")
    start_date_str = data.get("start_date_str", "")
    start_price = data.get("start_price", 0)

    cache_key = (
        f"event_pulse:{stock_symbol.upper()}:{timestamp}:{swing_type}:{start_date_str}"
    )

    try:
        prompt = PromptTemplate.load(EVENT_PULSE_PROMPT).render(
            stock_symbol=stock_symbol,
            timestamp=timestamp,
            date_str=date_str,
            price=price,
            swing_type=swing_type,
            start_date_str=start_date_str,
            start_price=start_price,
        )
    except PromptNotFoundError:
        return jsonify({"error": "Prompt not found"}), 404

    try:
        return _run_cached(cache_key, prompt, True, 3600)
    except Exception as e:
        current_app.logger.error(f"Error in event_pulse: {e}")
        return jsonify({"error": "Failed to generate Event Pulse analysis"}), 500


# ------------------------------------------------------------------ #
# Streaming routes                                                     #
# ------------------------------------------------------------------ #

@alphaBot_bp.route("/alphaBot/event_pulse/stream", methods=["POST"])
@login_required
def stream_event_pulse():
    """SSE streaming variant of event_pulse."""
    data = request.json
    stock_symbol = data.get("stock_symbol")
    timestamp = data.get("timestamp")
    if not stock_symbol or not timestamp:
        return jsonify({"error": "Stock symbol and timestamp are required"}), 400

    date_str = data.get("date_str", "")
    price = data.get("price", 0)
    swing_type = data.get("swing_type", "event")
    start_date_str = data.get("start_date_str", "")
    start_price = data.get("start_price", 0)

    cache_key = (
        f"event_pulse:{stock_symbol.upper()}:{timestamp}:{swing_type}:{start_date_str}"
    )

    try:
        prompt = PromptTemplate.load(EVENT_PULSE_PROMPT).render(
            stock_symbol=stock_symbol,
            timestamp=timestamp,
            date_str=date_str,
            price=price,
            swing_type=swing_type,
            start_date_str=start_date_str,
            start_price=start_price,
        )
    except PromptNotFoundError:
        return jsonify({"error": "Prompt not found"}), 404

    return _stream_cached(cache_key, prompt, True, 3600)


@alphaBot_bp.route("/alphaBot/in_depth_analysis/stream", methods=["POST"])
@login_required
def stream_in_depth_analysis():
    """SSE streaming variant of in_depth_analysis."""
    data = request.json
    symbol = data.get("stock_symbol")
    if not symbol:
        return jsonify({"error": "Stock symbol is required"}), 400

    try:
        prompt = PromptTemplate.load(IN_DEPTH_PROMPT).render(stock_symbol=symbol)
    except PromptNotFoundError:
        return jsonify({"error": "Prompt not found"}), 404

    return _stream_cached(f"in_depth_analysis:{symbol.upper()}", prompt, False, 900)


@alphaBot_bp.route("/alphaBot/user_query/stream", methods=["POST"])
@login_required
def stream_user_query():
    """SSE streaming variant of user_query (no caching — queries are unique)."""
    data = request.json
    user_query = data.get("user_query")
    stock_symbol = data.get("stock_symbol", "")
    if not user_query:
        return jsonify({"error": "User query is required"}), 400

    try:
        prompt = PromptTemplate.load(USER_QUERY_PROMPT).render(
            stock_symbol=stock_symbol,
            user_query=user_query,
        )
    except PromptNotFoundError:
        return jsonify({"error": "Prompt not found"}), 404

    accumulated: list[str] = []

    def _live() -> "Generator[str, None, None]":
        for sse_line in AlphaBotStreamer.stream_sync(prompt, include_tools=True):
            yield sse_line

    return Response(
        stream_with_context(_live()),
        mimetype="text/event-stream",
        headers=_SSE_HEADERS,
    )


@alphaBot_bp.route("/alphaBot/compare_analysis/stream", methods=["POST"])
@login_required
def stream_compare_analysis():
    """SSE streaming variant of compare_analysis."""
    data = request.json
    stock_symbols = data.get("stock_symbols")
    equations = data.get("equations", {})
    scores = data.get("scores", {})
    if not stock_symbols:
        return jsonify({"error": "Stock symbols are required"}), 400

    eq_hash = hashlib.md5(json.dumps(equations, sort_keys=True).encode()).hexdigest()
    symbols_key = "_".join(sorted(s.upper() for s in stock_symbols))
    cache_key = f"compare_analysis:{symbols_key}:{eq_hash}"

    try:
        prompt = PromptTemplate.load(COMPARE_PROMPT).render(
            stock_symbols=", ".join(stock_symbols)
        )
    except PromptNotFoundError:
        return jsonify({"error": "Prompt not found"}), 404

    market_context = "<market_data>\n=== USER'S CUSTOM ALGORITHMS ===\n"
    market_context += f"{json.dumps(equations, indent=2)}\n\n"
    market_context += "=== RESULTING SCORES (0-100, Higher is Better) ===\n"
    market_context += f"{json.dumps(scores, indent=2)}\n\n"

    for symbol in stock_symbols:
        stock = StockMaster.query.filter_by(symbol=symbol).first()
        if stock:
            stock_data = stock.to_dict()
            stock_data.pop("news_sentiment_data", None)
            stock_data.pop("income_statement", None)
            stock_data.pop("cash_flow_history", None)
            volume = stock.insider_volume or 0
            direction = (
                "NET BUYING (Positive Signal)" if volume > 0
                else "NET SELLING (Negative Signal)" if volume < 0
                else "NEUTRAL (No Signal / No Data)"
            )
            market_context += (
                f"Data for {symbol}:\nMETRICS: {json.dumps(stock_data, default=str)}\n"
                f"INSIDER_TRANSACTION_VOLUME: {volume:,.0f} shares ({direction})\n---\n"
            )
        else:
            market_context += f"Data for {symbol}: NOT FOUND IN CACHE\n---\n"

    market_context += "</market_data>\n\n"
    prompt = prompt + market_context

    return _stream_cached(cache_key, prompt, False, 900)
