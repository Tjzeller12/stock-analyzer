"""
AlphaBot AI Client
------------------
Owns the Claude conversation loop and exposes a clean synchronous facade.

  AlphaBotResult          — typed wrapper for a Claude response
  AlphaBotClient          — synchronous facade used by routes and analyses
  AlphaBotStreamer         — SSE streaming facade (async → sync bridge)
  StreamEvent             — typed SSE payload
  _ToolCall               — lightweight tool-call descriptor for the streaming path
  _run_tool_loop()        — ReAct loop (Reason + Act) for non-streaming endpoints
  _stream_alpha_bot()     — streaming ReAct loop (one API call per turn)
  _execute_tool_calls()   — parallel tool execution via MarketDataProvider
  _query_alpha_bot()      — async entry point wired to AlphaVantageProvider

The loop is fully vendor-agnostic: it depends only on MarketDataProvider,
not on Alpha Vantage specifically. Swapping providers requires no changes here.
"""
import asyncio
import json
import os
import queue
import threading
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Generator

from anthropic import AsyncAnthropic

from app.alphaBot.providers import AlphaVantageProvider, MarketDataProvider
from app.constants import CLAUDE_MODEL


# ------------------------------------------------------------------ #
# AlphaBotResult                                                       #
# ------------------------------------------------------------------ #

@dataclass
class AlphaBotResult:
    """
    Typed wrapper around a raw Claude response string.

    The ``cacheable`` property centralises the "real result vs error"
    check so routes never inspect raw string prefixes directly.
    """
    text: str

    _ERROR_PREFIXES = (
        "**Alpha Bot is Unavailable:**",
        "System Error:",
        "Error:",
        "Analysis could not be completed",
        "Analysis timed out",
    )

    @property
    def cacheable(self) -> bool:
        return not any(self.text.startswith(p) for p in self._ERROR_PREFIXES)


# ------------------------------------------------------------------ #
# AlphaBotClient                                                       #
# ------------------------------------------------------------------ #

# ------------------------------------------------------------------ #
# StreamEvent                                                          #
# ------------------------------------------------------------------ #

@dataclass
class StreamEvent:
    """
    A typed Server-Sent Event payload for AlphaBot streaming responses.

    Types
    -----
    tool_running — Claude is executing external tool calls.
                   ``count`` = number of parallel calls in this batch.
    chunk        — A text delta from the final generation pass.
    done         — Stream is complete; clients should stop listening.
    error        — A non-retryable error; ``message`` contains details.
    """
    type: str
    text: str = field(default="")
    count: int = field(default=0)
    message: str = field(default="")

    def to_sse(self) -> str:
        """Encode as a Server-Sent Event line."""
        payload = {"type": self.type}
        if self.text:
            payload["text"] = self.text
        if self.count:
            payload["count"] = self.count
        if self.message:
            payload["message"] = self.message
        return f"data: {json.dumps(payload)}\n\n"

    # ── Factory methods ──────────────────────────────────────────── #

    @classmethod
    def chunk(cls, text: str) -> "StreamEvent":
        return cls(type="chunk", text=text)

    @classmethod
    def tool_running(cls, count: int, message: str = "") -> "StreamEvent":
        return cls(type="tool_running", count=count, message=message)

    @classmethod
    def done(cls) -> "StreamEvent":
        return cls(type="done")

    @classmethod
    def error(cls, message: str) -> "StreamEvent":
        return cls(type="error", message=message)


# ------------------------------------------------------------------ #
# AlphaBotClient / AlphaBotStreamer                                   #
# ------------------------------------------------------------------ #

class AlphaBotClient:
    """
    Synchronous facade over the async query pipeline.

    Routes and analysis classes call ``run_sync`` and receive an
    ``AlphaBotResult`` without ever touching asyncio directly.
    """

    @staticmethod
    def run_sync(prompt: str, *, include_tools: bool = False) -> AlphaBotResult:
        """Run a prompt through Claude (blocking). Returns AlphaBotResult."""
        text = asyncio.run(_query_alpha_bot(prompt, include_tools))
        return AlphaBotResult(text=text)


class AlphaBotStreamer:
    """
    Streams AlphaBot responses as Server-Sent Events.

    Bridges the async ReAct pipeline to Flask's synchronous response
    streaming via a background thread + blocking queue.

    Usage (in a Flask route)::

        return Response(
            stream_with_context(AlphaBotStreamer.stream_sync(prompt, True)),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    """

    @staticmethod
    def stream_sync(
        prompt: str, *, include_tools: bool = False
    ) -> Generator[str, None, None]:
        """
        Synchronous SSE generator. Yields raw ``data: ...`` SSE lines.

        - Yields ``tool_running`` events while Claude executes tools.
        - Yields real-time ``chunk`` events from Anthropic's streaming API
          once the final generation turn begins.
        - Yields a final ``done`` event on success.
        """
        event_queue: "queue.Queue[StreamEvent | None]" = queue.Queue()

        def _run_in_thread() -> None:
            async def _async_run() -> None:
                async for event in _stream_alpha_bot(prompt, include_tools):
                    event_queue.put(event)
                event_queue.put(None)  # sentinel

            asyncio.run(_async_run())

        thread = threading.Thread(target=_run_in_thread, daemon=True)
        thread.start()

        while True:
            event = event_queue.get()
            if event is None:
                break
            yield event.to_sse()


# ------------------------------------------------------------------ #
# Context management                                                   #
# ------------------------------------------------------------------ #

def _estimate_context_chars(messages: list[dict]) -> int:
    """
    Character count of the full message history.

    Uses json.dumps(default=str) so Anthropic SDK objects (TextBlock,
    ToolUseBlock, etc.) are serialized via __repr__ rather than silently
    skipped, giving an accurate size estimate for assistant turns.
    """
    try:
        return len(json.dumps(messages, default=str))
    except Exception:
        return sum(len(str(msg)) for msg in messages)


def _prune_old_tool_results(messages: list[dict], max_chars: int) -> None:
    """
    Replace the content of the oldest tool_result blocks with a placeholder
    when the accumulated history exceeds max_chars.

    Always preserves the first message (user prompt) and the last 4 messages
    (most recent assistant thought + tool results).
    """
    if _estimate_context_chars(messages) <= max_chars:
        return

    PLACEHOLDER = "[Truncated — already incorporated into analysis]"

    for msg in messages[1: max(1, len(messages) - 4)]:
        if msg.get("role") != "user":
            continue
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if (isinstance(block, dict)
                    and block.get("type") == "tool_result"
                    and block.get("content") != PLACEHOLDER):
                block["content"] = PLACEHOLDER
                if _estimate_context_chars(messages) <= max_chars:
                    return


# ------------------------------------------------------------------ #
# Tool execution                                                        #
# ------------------------------------------------------------------ #

async def _execute_tool_calls(
    provider: MarketDataProvider, tool_calls: list[Any]
) -> list[dict]:
    """
    Execute all tool-use blocks in parallel via the provider adapter.

    Accepts both Anthropic SDK ToolUseBlock objects (from the non-streaming
    ReAct loop) and ``_ToolCall`` dataclass instances (from the streaming loop).
    Both expose ``.id``, ``.name``, ``.input``, and ``.type`` attributes.

    A hard 12k character cap is applied as a final safety net.
    """
    tool_use_items = [c for c in tool_calls if getattr(c, "type", None) == "tool_use"]
    if not tool_use_items:
        return []

    results = await asyncio.gather(
        *[provider.call_tool(item.name, item.input) for item in tool_use_items],
        return_exceptions=True,
    )

    MAX_RESULT_CHARS = 12_000
    tool_results = []

    for item, result in zip(tool_use_items, results):
        if isinstance(result, Exception):
            print(f"ERROR: Tool execution failed for {item.name}: {result}", flush=True)
            tool_output = f"Error executing tool {item.name}: {result}"
        else:
            tool_output = result
            if len(tool_output) > MAX_RESULT_CHARS:
                tool_output = tool_output[:MAX_RESULT_CHARS] + "\n[...truncated]"

        tool_results.append({
            "role": "user",
            "content": [{"type": "tool_result", "tool_use_id": item.id, "content": tool_output}],
        })

    return tool_results


# ------------------------------------------------------------------ #
# ReAct loop                                                           #
# ------------------------------------------------------------------ #

async def _run_tool_loop(
    client: AsyncAnthropic,
    anthropic_tools: list[dict],
    messages: list[dict],
    provider: MarketDataProvider,
) -> str:
    """
    The main ReAct loop (Reason + Act).

    1. Proactively prune old tool results before every API call.
    2. Send message history to Claude.
    3. If Claude requests tools → execute via provider → extend history → repeat.
    4. If Claude is done → return final text.

    Two-layer context protection:
      Proactive: _prune_old_tool_results fires before every call (320k chars).
      Reactive:  if the API still rejects, emergency-prune to 40k chars and
                 retry once before returning a clean error message.
    """
    MAX_CONTEXT_CHARS = 320_000
    EMERGENCY_CONTEXT_CHARS = 40_000

    for _ in range(50):
        _prune_old_tool_results(messages, MAX_CONTEXT_CHARS)

        try:
            response = await client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=8192,
                messages=messages,
                tools=anthropic_tools,
            )
        except Exception as e:
            err = str(e)
            if "prompt is too long" in err:
                print(f"WARNING: Token limit hit — emergency pruning. ({err})", flush=True)
                _prune_old_tool_results(messages, EMERGENCY_CONTEXT_CHARS)
                try:
                    response = await client.messages.create(
                        model=CLAUDE_MODEL,
                        max_tokens=8192,
                        messages=messages,
                        tools=anthropic_tools,
                    )
                except Exception as retry_err:
                    print(f"ERROR: Retry after emergency prune failed: {retry_err}", flush=True)
                    return (
                        "Analysis could not be completed: the requested time range "
                        "is too large. Try selecting a shorter window."
                    )
            else:
                raise

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            return response.content[0].text

        tool_results = await _execute_tool_calls(provider, response.content)
        messages.extend(tool_results)

    return "Analysis timed out or reached max turns."


# ------------------------------------------------------------------ #
# _ToolCall — lightweight descriptor for the streaming path            #
# ------------------------------------------------------------------ #

@dataclass
class _ToolCall:
    """
    Holds one tool-use block collected from the Anthropic streaming API.

    Attribute names match what ``_execute_tool_calls`` and ``_describe_tools``
    expect (``id``, ``name``, ``input``, ``type``), so both helpers work with
    this dataclass and with the real Anthropic SDK tool_use objects.
    """
    id: str
    name: str
    input: dict
    type: str = "tool_use"


# ------------------------------------------------------------------ #
# Streaming entry point                                                #
# ------------------------------------------------------------------ #

async def _stream_alpha_bot(
    prompt: str, include_tools: bool
) -> AsyncGenerator[StreamEvent, None]:
    """
    Async generator: one Anthropic streaming API call per turn.

    Each turn:
      • Streams the response into a local buffer — nothing reaches the
        client during tool-use turns.
      • If the turn contains tool_use blocks → emit ``tool_running`` with
        a human-readable description, execute tools, loop.
      • If the turn has no tool_use (final turn) → emit the buffered text
        as smooth word-level chunks, then ``done``.

    One API call per turn — same as the original non-streaming code.
    No extra latency.  No spaghetti.
    """
    api_key = os.getenv("ALPHA_VANTAGE_KEY")
    if not api_key:
        yield StreamEvent.error("Backend missing configuration.")
        return

    provider: MarketDataProvider = AlphaVantageProvider(api_key)
    MAX_CONTEXT_CHARS = 320_000
    EMERGENCY_CONTEXT_CHARS = 40_000

    try:
        anthropic_tools = await provider.get_tools() if include_tools else []

        async with AsyncAnthropic() as claude:
            messages: list[dict] = [{"role": "user", "content": prompt}]

            for _ in range(50):
                _prune_old_tool_results(messages, MAX_CONTEXT_CHARS)

                text_buf = ""
                tool_calls: list[_ToolCall] = []
                tool_json_bufs: dict[str, str] = {}  # tool_id → partial input JSON

                # ── Stream this turn into a local buffer ──────────────── #
                stream_kwargs: dict[str, Any] = dict(
                    model=CLAUDE_MODEL,
                    max_tokens=8192,
                    messages=messages,
                )
                if anthropic_tools:
                    stream_kwargs["tools"] = anthropic_tools

                try:
                    async with claude.messages.stream(**stream_kwargs) as stream:
                        async for event in stream:
                            etype = event.type

                            if etype == "content_block_start":
                                b = event.content_block
                                if b.type == "tool_use":
                                    tool_calls.append(
                                        _ToolCall(id=b.id, name=b.name, input={})
                                    )
                                    tool_json_bufs[b.id] = ""

                            elif etype == "content_block_delta":
                                d = event.delta
                                if d.type == "text_delta":
                                    text_buf += d.text
                                elif d.type == "input_json_delta" and tool_calls:
                                    tool_json_bufs[tool_calls[-1].id] += d.partial_json

                except Exception as e:
                    err = str(e)
                    if "prompt is too long" in err:
                        print("WARNING: Token limit hit — emergency pruning.", flush=True)
                        _prune_old_tool_results(messages, EMERGENCY_CONTEXT_CHARS)
                        # retry the same turn at reduced context
                        text_buf = ""
                        tool_calls = []
                        tool_json_bufs = {}
                        try:
                            async with claude.messages.stream(**stream_kwargs) as stream:
                                async for event in stream:
                                    etype = event.type
                                    if etype == "content_block_start":
                                        b = event.content_block
                                        if b.type == "tool_use":
                                            tool_calls.append(
                                                _ToolCall(id=b.id, name=b.name, input={})
                                            )
                                            tool_json_bufs[b.id] = ""
                                    elif etype == "content_block_delta":
                                        d = event.delta
                                        if d.type == "text_delta":
                                            text_buf += d.text
                                        elif d.type == "input_json_delta" and tool_calls:
                                            tool_json_bufs[tool_calls[-1].id] += d.partial_json
                        except Exception as retry_err:
                            print(f"ERROR: Retry failed: {retry_err}", flush=True)
                            yield StreamEvent.error(
                                "Context too large — try a shorter time window."
                            )
                            return
                    else:
                        raise

                # Parse accumulated JSON inputs for each tool call
                for tc in tool_calls:
                    try:
                        tc.input = json.loads(tool_json_bufs.get(tc.id, "{}"))
                    except json.JSONDecodeError:
                        tc.input = {}

                if tool_calls:
                    # ── Tool-use turn ─────────────────────────────────── #
                    # Build assistant content for the message history
                    content: list[dict] = []
                    if text_buf:
                        content.append({"type": "text", "text": text_buf})
                    for tc in tool_calls:
                        content.append({
                            "type": "tool_use",
                            "id": tc.id,
                            "name": tc.name,
                            "input": tc.input,
                        })
                    messages.append({"role": "assistant", "content": content})

                    yield StreamEvent.tool_running(
                        len(tool_calls),
                        message=_describe_tools(tool_calls),
                    )
                    tool_results = await _execute_tool_calls(provider, tool_calls)
                    messages.extend(tool_results)

                else:
                    # ── Final turn: stream as smooth word-level chunks ─── #
                    for chunk in _word_chunks(text_buf):
                        yield StreamEvent.chunk(chunk)
                        await asyncio.sleep(0.02)   # ~50 words/sec — smooth appearance
                    yield StreamEvent.done()
                    return

            yield StreamEvent.error("Analysis timed out — reached maximum turns.")

    except Exception as e:
        print(f"CRITICAL ERROR in _stream_alpha_bot: {e}", flush=True)
        err_msg = str(e)
        if "credit balance is too low" in err_msg:
            yield StreamEvent.error(
                "Alpha Bot is temporarily unavailable due to high usage."
            )
        else:
            yield StreamEvent.error(err_msg)


_TOOL_LABELS: dict[str, str] = {
    # Alpha Vantage function names → human-readable labels
    "NEWS_SENTIMENT": "news sentiment",
    "GLOBAL_QUOTE": "live price",
    "TIME_SERIES_DAILY": "price history",
    "TIME_SERIES_DAILY_ADJUSTED": "price history",
    "TIME_SERIES_INTRADAY": "intraday price data",
    "OVERVIEW": "company overview",
    "BALANCE_SHEET": "balance sheet",
    "INCOME_STATEMENT": "income statement",
    "CASH_FLOW": "cash flow statement",
    "INSIDER_TRANSACTIONS": "insider transactions",
    "EARNINGS": "earnings history",
    # MCP meta-tools
    "TOOL_LIST": "available data sources",
    "TOOL_GET": "data schema",
    "TOOL_CALL": "market data",
}


def _describe_tools(tool_items: list[Any]) -> str:
    """
    Turn a list of tool_use content blocks into a friendly progress message.

    Tries to extract the Alpha Vantage function name from the ``input`` dict
    (e.g. ``input.function_name = "NEWS_SENTIMENT"``); falls back to the raw
    tool name if not present.
    """
    labels: list[str] = []
    for item in tool_items:
        fn_name: str | None = None
        if hasattr(item, "input") and isinstance(item.input, dict):
            fn_name = (
                item.input.get("function_name")
                or item.input.get("name")
            )

        key = fn_name or (item.name if hasattr(item, "name") else "")
        label = _TOOL_LABELS.get(key, key.lower().replace("_", " "))
        if label and label not in labels:
            labels.append(label)

    if not labels:
        return "Gathering market data…"
    if len(labels) == 1:
        return f"Grabbing {labels[0]}…"
    if len(labels) == 2:
        return f"Grabbing {labels[0]} & {labels[1]}…"
    return f"Grabbing {', '.join(labels[:-1])} & {labels[-1]}…"


def _word_chunks(text: str, batch_size: int = 6) -> list[str]:
    """Split text into small word batches for simulated streaming fallback."""
    words = text.split(" ")
    chunks = []
    for i in range(0, len(words), batch_size):
        part = " ".join(words[i : i + batch_size])
        if i + batch_size < len(words):
            part += " "
        chunks.append(part)
    return chunks


# ------------------------------------------------------------------ #
# Entry point (non-streaming)                                          #
# ------------------------------------------------------------------ #

async def _query_alpha_bot(prompt: str, include_tools: bool) -> str:
    """
    Core async entry point. Run via AlphaBotClient.run_sync() from sync code.

    Instantiates the configured provider (Alpha Vantage by default) and
    wires it into the ReAct loop.  Swapping providers means changing one
    line here — nothing else in the codebase needs to change.
    """
    api_key = os.getenv("ALPHA_VANTAGE_KEY")
    if not api_key:
        print("ERROR: Missing ALPHA_VANTAGE_KEY", flush=True)
        return "Error: Backend missing configuration."

    provider: MarketDataProvider = AlphaVantageProvider(api_key)

    try:
        anthropic_tools = await provider.get_tools() if include_tools else []

        async with AsyncAnthropic() as client:
            messages = [{"role": "user", "content": prompt}]
            return await _run_tool_loop(client, anthropic_tools, messages, provider)

    except Exception as e:
        print(f"CRITICAL ERROR in _query_alpha_bot: {e}", flush=True)
        err_msg = str(e)
        if "credit balance is too low" in err_msg:
            return (
                "**Alpha Bot is Unavailable:** We apologize, but Alpha Bot is currently "
                "experiencing high token usage. Please try again later."
            )
        return f"System Error: {err_msg}"
