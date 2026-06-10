"""
Market Data Providers
---------------------
Adapter pattern for swapping data vendors without touching the AI loop.

  MarketDataProvider (ABC)   ← the contract the ReAct loop talks to
      └── AlphaVantageProvider  ← wraps HttpMCPClient + AlphaVantagePayloadStripper

To add a new vendor (e.g. Polygon.io, Twelve Data):
    1. Subclass MarketDataProvider.
    2. Implement get_tools() and call_tool().
    3. Pass an instance into _query_alpha_bot().
    The ReAct loop, context management, and routes are completely untouched.
"""
from abc import ABC, abstractmethod

import httpx

from app.constants import ALPHA_VANTAGE_MCP_URL
from app.services.payload_stripper import AlphaVantagePayloadStripper


# ================================================================== #
# Contract                                                             #
# ================================================================== #

class MarketDataProvider(ABC):
    """
    Abstract adapter that the ReAct loop depends on.

    Implementors handle all vendor-specific concerns:
      - transport protocol  (MCP JSON-RPC, REST, WebSocket, …)
      - authentication      (API key, OAuth, …)
      - tool format         (Anthropic schema, OpenAI schema, …)
      - response stripping  (reduce payload before Claude sees it)
    """

    @abstractmethod
    async def get_tools(self) -> list[dict]:
        """Return available tools in Anthropic tool-call format."""

    @abstractmethod
    async def call_tool(self, name: str, arguments: dict) -> str:
        """
        Execute a single tool call and return a stripped string result
        ready to be inserted into Claude's message history.
        """


# ================================================================== #
# Alpha Vantage transport (MCP JSON-RPC)                              #
# ================================================================== #

class _HttpMCPClient:
    """
    Private low-level JSON-RPC-over-HTTP client for the AV MCP server.

    Intentionally not exported — callers should use AlphaVantageProvider,
    not this class directly.
    """

    def __init__(self, base_url: str, api_key: str):
        self._url = f"{base_url}?apikey={api_key}"
        self._request_id = 0

    async def call_method(self, method: str, params: dict | None = None) -> dict:
        self._request_id += 1
        payload = {
            "jsonrpc": "2.0",
            "method":  method,
            "params":  params or {},
            "id":      self._request_id,
        }
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(self._url, json=payload, timeout=30.0)
                resp.raise_for_status()
                data = resp.json()
                if "error" in data:
                    print(f"ERROR: MCP Protocol Error: {data['error']}", flush=True)
                    raise Exception(f"MCP Error: {data['error']}")
                return data.get("result", {})
            except Exception as e:
                print(f"ERROR: MCP Connection Error: {e}", flush=True)
                raise

    async def list_tools(self) -> list[dict]:
        res = await self.call_method("tools/list")
        return res.get("tools", [])

    async def call_tool(self, name: str, arguments: dict) -> list[dict]:
        res = await self.call_method("tools/call", {"name": name, "arguments": arguments})
        return res.get("content", [])


# ================================================================== #
# Alpha Vantage adapter                                                #
# ================================================================== #

class AlphaVantageProvider(MarketDataProvider):
    """
    Concrete adapter for the Alpha Vantage MCP.

    Responsibilities:
      - Discovers tools via JSON-RPC and converts them to Anthropic format.
      - Calls tools and strips the raw response through AlphaVantagePayloadStripper
        before returning it to the ReAct loop.
    """

    def __init__(self, api_key: str):
        self._mcp = _HttpMCPClient(ALPHA_VANTAGE_MCP_URL, api_key)

    async def get_tools(self) -> list[dict]:
        available = await self._mcp.list_tools()
        return [
            {
                "name":         tool.get("name"),
                "description":  tool.get("description"),
                "input_schema": tool.get("inputSchema"),
            }
            for tool in available
        ]

    async def call_tool(self, name: str, arguments: dict) -> str:
        content = await self._mcp.call_tool(name, arguments)

        raw = "".join(
            block.get("text", "") if block.get("type") == "text" else str(block)
            for block in content
        )
        stripped = AlphaVantagePayloadStripper.strip(name, raw)

        print(
            f"TOOL: {name} | raw={len(raw):,} stripped={len(stripped):,} chars",
            flush=True,
        )
        return stripped
