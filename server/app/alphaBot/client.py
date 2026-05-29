"""
AlphaBot AI Client
------------------
Owns everything related to talking to Claude via the Alpha Vantage MCP:
  - HttpMCPClient   : low-level JSON-RPC over HTTP POST to mcp.alphavantage.co
  - AlphaBotResult  : typed wrapper for a Claude response (text + cacheable flag)
  - AlphaBotClient  : synchronous facade used by routes and analysis classes
  - Internal async helpers: tool discovery, tool execution, context pruning,
    and the main ReAct loop
"""
import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any

import httpx
from anthropic import AsyncAnthropic

from app.constants import ALPHA_VANTAGE_MCP_URL, CLAUDE_MODEL
from app.services.payload_stripper import AlphaVantagePayloadStripper


# ------------------------------------------------------------------ #
# HttpMCPClient                                                        #
# ------------------------------------------------------------------ #

class HttpMCPClient:
    """
    Custom HTTP client for the Alpha Vantage MCP server.

    The AV MCP is stateless (HTTP POST + JSON-RPC).  The Anthropic MCP SDK
    uses SSE/stdio transports which don't apply here, so we roll our own.
    """

    def __init__(self, base_url: str, api_key: str):
        self.url = f"{base_url}?apikey={api_key}"
        self.request_id = 0

    async def call_method(self, method: str, params: dict | None = None) -> dict:
        self.request_id += 1
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self.request_id,
        }
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(self.url, json=payload, timeout=30.0)
                resp.raise_for_status()
                data = resp.json()
                if "error" in data:
                    print(f"ERROR: MCP Protocol Error: {data['error']}", flush=True)
                    raise Exception(f"MCP Error: {data['error']}")
                return data.get("result", {})
            except Exception as e:
                print(f"ERROR: MCP Connection Error: {str(e)}", flush=True)
                raise

    async def list_tools(self) -> list[dict]:
        res = await self.call_method("tools/list")
        return res.get("tools", [])

    async def call_tool(self, name: str, arguments: dict) -> list[dict]:
        res = await self.call_method("tools/call", {"name": name, "arguments": arguments})
        return res.get("content", [])


# ------------------------------------------------------------------ #
# AlphaBotResult                                                       #
# ------------------------------------------------------------------ #

@dataclass
class AlphaBotResult:
    """
    Typed wrapper around a raw Claude response string.

    The ``cacheable`` property centralises the "is this a real result or an
    error message?" check so routes never need to inspect string prefixes.
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

    Routes and analysis classes call ``run_sync`` and get back an
    ``AlphaBotResult`` without ever touching asyncio directly.
    """

    @staticmethod
    def run_sync(prompt: str, *, include_tools: bool = False) -> AlphaBotResult:
        """Run a prompt through Claude (blocking). Returns AlphaBotResult."""
        text = asyncio.run(_query_alpha_bot(prompt, include_tools))
        return AlphaBotResult(text=text)


# ------------------------------------------------------------------ #
# Internal async pipeline                                              #
# ------------------------------------------------------------------ #

async def _discover_tools(av_client: HttpMCPClient) -> list[dict]:
    """
    Fetch available tools from the AV MCP server and convert them to the
    format expected by the Anthropic messages API (snake_case schema keys).
    """
    available = await av_client.list_tools()
    return [
        {
            "name":         tool.get("name"),
            "description":  tool.get("description"),
            "input_schema": tool.get("inputSchema"),
        }
        for tool in available
    ]


async def _execute_tool_calls(
    av_client: HttpMCPClient, tool_calls: list[Any]
) -> list[dict]:
    """
    Execute all tool-use blocks from a Claude response in parallel and
    return them as a list of tool_result user messages.

    Each raw result is passed through AlphaVantagePayloadStripper and capped
    at 12k characters so no single tool response can blow the context window.
    """
    tool_use_items = [c for c in tool_calls if c.type == "tool_use"]
    if not tool_use_items:
        return []

    results = await asyncio.gather(
        *[av_client.call_tool(item.name, item.input) for item in tool_use_items],
        return_exceptions=True,
    )

    tool_results = []
    for item, raw_result in zip(tool_use_items, results):
        tool_output = ""

        if isinstance(raw_result, Exception):
            print(f"ERROR: Tool execution failed for {item.name}: {raw_result}", flush=True)
            tool_output = f"Error executing tool {item.name}: {str(raw_result)}"
        else:
            for block in raw_result:
                if block.get("type") == "text":
                    tool_output += block.get("text", "")
                else:
                    tool_output += str(block)

            raw_len = len(tool_output)
            tool_output = AlphaVantagePayloadStripper.strip(item.name, tool_output)
            stripped_len = len(tool_output)

            MAX_RESULT_CHARS = 12_000
            if len(tool_output) > MAX_RESULT_CHARS:
                tool_output = tool_output[:MAX_RESULT_CHARS] + "\n[...truncated]"

            print(
                f"TOOL: {item.name} | raw={raw_len:,} stripped={stripped_len:,} "
                f"final={len(tool_output):,} chars",
                flush=True,
            )

        tool_results.append({
            "role": "user",
            "content": [{"type": "tool_result", "tool_use_id": item.id, "content": tool_output}],
        })

    return tool_results


def _estimate_context_chars(messages: list[dict]) -> int:
    """
    Character count of the full message history.

    Uses json.dumps(default=str) so Anthropic SDK objects (TextBlock,
    ToolUseBlock, etc.) are serialized via their __repr__ rather than
    silently skipped.  This gives an accurate size estimate even for
    assistant turns that contain non-dict content blocks.
    """
    try:
        return len(json.dumps(messages, default=str))
    except Exception:
        return sum(len(str(msg)) for msg in messages)


def _prune_old_tool_results(messages: list[dict], max_chars: int) -> None:
    """
    When the accumulated message history exceeds max_chars, replace the
    content of the oldest tool_result blocks with a short placeholder.

    The first message (user prompt) and the last 4 messages (most recent
    assistant thought + tool results) are always preserved.
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


async def _run_tool_loop(
    client: AsyncAnthropic,
    anthropic_tools: list[dict],
    messages: list[dict],
    av_client: HttpMCPClient,
) -> str:
    """
    The main ReAct loop (Reason + Act).

    1. Proactively prune old tool results before every API call.
    2. Send message history to Claude.
    3. If Claude requests tools → execute → extend history → repeat.
    4. If Claude is done → return final text.

    Two-layer context protection:
      Proactive: _prune_old_tool_results fires before every call (320k chars).
      Reactive:  if the API still rejects with prompt-too-long, emergency-prune
                 to 40k chars and retry once before surfacing a clean message.
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

        tool_results = await _execute_tool_calls(av_client, response.content)
        messages.extend(tool_results)

    return "Analysis timed out or reached max turns."


async def _query_alpha_bot(prompt: str, include_tools: bool) -> str:
    """Core async entry point. Run via AlphaBotClient.run_sync() from sync code."""
    api_key = os.getenv("ALPHA_VANTAGE_KEY")
    if not api_key:
        print("ERROR: Missing ALPHA_VANTAGE_KEY", flush=True)
        return "Error: Backend missing configuration."

    av_client = HttpMCPClient(ALPHA_VANTAGE_MCP_URL, api_key)

    try:
        anthropic_tools = []
        if include_tools:
            anthropic_tools = await _discover_tools(av_client)

        async with AsyncAnthropic() as client:
            messages = [{"role": "user", "content": prompt}]
            return await _run_tool_loop(client, anthropic_tools, messages, av_client)

    except Exception as e:
        print(f"CRITICAL ERROR in _query_alpha_bot: {e}", flush=True)
        err_msg = str(e)
        if "credit balance is too low" in err_msg:
            return (
                "**Alpha Bot is Unavailable:** We apologize, but Alpha Bot is currently "
                "experiencing high token usage. Please try again later."
            )
        return f"System Error: {err_msg}"
