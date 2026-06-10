"""
AlphaBot AI Client
------------------
Owns the Claude conversation loop and exposes a clean synchronous facade.

  AlphaBotResult          — typed wrapper for a Claude response
  AlphaBotClient          — synchronous facade used by routes and analyses
  _run_tool_loop()        — ReAct loop (Reason + Act)
  _execute_tool_calls()   — parallel tool execution via MarketDataProvider
  _query_alpha_bot()      — async entry point wired to AlphaVantageProvider

The loop is fully vendor-agnostic: it depends only on MarketDataProvider,
not on Alpha Vantage specifically. Swapping providers requires no changes here.
"""
import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any

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
    Execute all tool-use blocks from a Claude response in parallel via
    the provider adapter and return them as tool_result user messages.

    The provider is responsible for stripping each result.  A hard 12k
    character cap is applied here as a final safety net for any payload
    the provider didn't recognise.
    """
    tool_use_items = [c for c in tool_calls if c.type == "tool_use"]
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
# Entry point                                                          #
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
