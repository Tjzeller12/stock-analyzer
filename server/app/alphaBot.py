from flask import Blueprint, request, jsonify, current_app
from app import cache
import requests
import os
import json
import hashlib
from app.constants import ALPHA_VANTAGE_MCP_URL, CLAUDE_MODEL, USER_QUERY_PROMPT, COMPARE_PROMPT, IN_DEPTH_PROMPT, EVENT_PULSE_PROMPT, MOAT_ANALYSIS_PROMPT, NEWS_ANALYSIS_PROMPT
from app.utils.api import build_alpha_vantage_url
from app.constants import AlphaVantageFunction
from app.services.payload_stripper import AlphaVantagePayloadStripper
from anthropic import AsyncAnthropic
from app.models import StockMaster
import asyncio

# Make alphaBot blueprint
alphaBot_bp = Blueprint('alphaBot', __name__)

import httpx

# Custom HTTP MCP Client to handle Alpha Vantage's JSON-RPC over HTTP POST
# The Alpha Vantage server is stateless (HTTP POST). 
class HttpMCPClient:
    def __init__(self, base_url, api_key):
        self.url = f"{base_url}?apikey={api_key}"
        self.request_id = 0
        
    async def call_method(self, method, params=None):

        self.request_id += 1
        # Construct the JSON-RPC envelope manually
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self.request_id
        }

        async with httpx.AsyncClient() as client:
            try:
                # We use a standard HTTP POST with the JSON-RPC payload
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

    async def list_tools(self):

        res = await self.call_method("tools/list")
        tools = res.get("tools", [])

        return tools

    async def call_tool(self, name, arguments):

         # In JSON-RPC, calling a tool is just another method 'tools/call'
         res = await self.call_method("tools/call", {"name": name, "arguments": arguments})
         content = res.get("content", [])

         return content

async def _discover_tools(av_client):
    """
    Fetches available tools from the Alpha Vantage MCP server and formats them 
    for the Anthropic API.
    
    Args:
        av_client (HttpMCPClient): The initialized MCP client.
        
    Returns:
        list: A list of tool definitions in the format expected by Claude (snake_case schema).
    """
    # 1. Fetch raw tools from Alpha Vantage (JSON-RPC)
    available_tools = await av_client.list_tools()
    
    # 2. Convert to Anthropic format
    anthropic_tools = []
    for tool in available_tools:
        # Note: MCP uses 'inputSchema' (camelCase), but Anthropic expects 'input_schema' (snake_case)
        anthropic_tools.append({
            "name": tool.get("name"),
            "description": tool.get("description"),
            "input_schema": tool.get("inputSchema")
        })
    return anthropic_tools

async def _execute_tool_calls(av_client, tool_calls):
    """
    Iterates through Claude's response content, executes any requested tools PARALLEL,
    and returns the results formatted as a list of user messages.
    """
    tool_results = []
    
    # Identify which items are actually tool uses
    tool_use_items = [c for c in tool_calls if c.type == "tool_use"]
    
    if not tool_use_items:
        return []

    # Create a coroutine for each tool call
    tasks = []
    for item in tool_use_items:
        tasks.append(av_client.call_tool(item.name, item.input))

    # Execute all tools in parallel
    # return_exceptions=True so one failure doesn't crash the whole batch
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Process results back into the format Claude expects
    for i, item in enumerate(tool_use_items):
        raw_result = results[i]
        tool_output = ""

        if isinstance(raw_result, Exception):
            print(f"ERROR: Tool execution failed for {item.name}: {raw_result}", flush=True)
            tool_output = f"Error executing tool {item.name}: {str(raw_result)}"
        else:
            # Result is a list of content blocks (text or image)
            for block in raw_result:
                if block.get("type") == "text":
                    tool_output += block.get("text", "")
                else:
                    tool_output += str(block)

            raw_len = len(tool_output)
            # Strip the payload down to fields Claude actually needs.
            # Prevents token-limit errors on large Alpha Vantage responses.
            tool_output = AlphaVantagePayloadStripper.strip(item.name, tool_output)
            stripped_len = len(tool_output)

            # Hard per-result cap: if stripping didn't recognise the tool name
            # (unknown/future tools), truncate to 12k chars (~3k tokens) so a
            # single unrecognised tool can never blow the context window.
            MAX_RESULT_CHARS = 12_000
            if len(tool_output) > MAX_RESULT_CHARS:
                tool_output = tool_output[:MAX_RESULT_CHARS] + "\n[...truncated]"

            print(
                f"TOOL: {item.name} | raw={raw_len:,} stripped={stripped_len:,} final={len(tool_output):,} chars",
                flush=True
            )

        tool_results.append({
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": item.id,
                "content": tool_output
            }]
        })

    return tool_results

def _estimate_context_chars(messages) -> int:
    """
    Character count of the full message history.

    Uses json.dumps(default=str) so that Anthropic SDK objects (TextBlock,
    ToolUseBlock, etc.) are serialized via their __repr__ rather than silently
    skipped. This gives an accurate size estimate even for assistant turns
    that contain non-dict content blocks.
    """
    try:
        return len(json.dumps(messages, default=str))
    except Exception:
        return sum(len(str(msg)) for msg in messages)


def _prune_old_tool_results(messages, max_chars: int) -> None:
    """
    When the accumulated message history exceeds max_chars, replace the
    content of the oldest tool_result blocks with a short placeholder.

    We always leave the first message (the user prompt) and the last four
    messages (the most recent assistant thought + tool results) untouched
    so Claude retains enough context to write its final answer.
    """
    if _estimate_context_chars(messages) <= max_chars:
        return

    PLACEHOLDER = "[Truncated — already incorporated into analysis]"

    # Iterate over everything except the first and last 4 messages
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
                # Re-check after each replacement — stop as soon as we're under budget
                if _estimate_context_chars(messages) <= max_chars:
                    return


async def _run_tool_loop(client, anthropic_tools, messages, av_client):
    """
    The main 'ReAct' loop (Reason + Act).
    
    1. Sends history to Claude.
    2. Checks if Claude wants to stop or use a tool.
    3. If tool use: executes tools -> adds results to history -> repeats loop.
    4. If stop: returns the final text response.

    Context budget: ~80k tokens (320k chars at ~4 chars/token).
    The remaining ~120k token buffer absorbs the tool-schema overhead
    (~15-20k tokens for all AV MCP tools on every call) plus Claude's
    8k max_tokens output, with room to spare.

    Two-layer protection against token limit errors:
      - Proactive: _prune_old_tool_results fires before every API call.
      - Reactive: if the API still rejects with a prompt-too-long error,
        we emergency-prune ALL old results and retry once before giving up.
    """
    MAX_CONTEXT_CHARS = 320_000
    # Emergency floor: keep only the prompt + last 4 messages
    EMERGENCY_CONTEXT_CHARS = 40_000

    for i in range(50): # Safety limit to prevent infinite loops (cost protection)
        # Proactive prune: trim oldest tool results before sending
        _prune_old_tool_results(messages, MAX_CONTEXT_CHARS)

        try:
            response = await client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=8192,
                messages=messages,
                tools=anthropic_tools
            )
        except Exception as e:
            err = str(e)
            if "prompt is too long" in err:
                print(f"WARNING: Token limit hit — emergency pruning and retrying. ({err})", flush=True)
                # Nuclear option: prune everything down to bare minimum
                _prune_old_tool_results(messages, EMERGENCY_CONTEXT_CHARS)
                try:
                    response = await client.messages.create(
                        model=CLAUDE_MODEL,
                        max_tokens=8192,
                        messages=messages,
                        tools=anthropic_tools
                    )
                except Exception as retry_err:
                    print(f"ERROR: Retry after emergency prune also failed: {retry_err}", flush=True)
                    return "Analysis could not be completed: the requested time range is too large. Try selecting a shorter window."
            else:
                raise

        # Add Claude's "thought" (or tool request) to history
        messages.append({"role": "assistant", "content": response.content})
        
        # Exit condition: Claude has finished its analysis
        if response.stop_reason != "tool_use":
            return response.content[0].text
        
        # If we are here, Claude wants to use tools. Execute them.
        tool_results = await _execute_tool_calls(av_client, response.content)
        messages.extend(tool_results)
     
    return "Analysis timed out or reached max turns."

async def query_alpha_bot(prompt, include_tools):
    """Main entry point for AlphaBot queries."""
    # helper for api key
    api_key = os.getenv('ALPHA_VANTAGE_KEY')
    if not api_key:
        print("ERROR: Missing ALPHA_VANTAGE_KEY", flush=True)
        return "Error: Backend missing configuration."

    # Use our custom HTTP client
    av_client = HttpMCPClient(ALPHA_VANTAGE_MCP_URL, api_key)

    try:
        anthropic_tools = []
        # Step 1: Discover tools
        if include_tools:
            anthropic_tools = await _discover_tools(av_client)

        # Step 2: Use AsyncAnthropic as a context manager so the httpx
        # transport and connection pool are properly closed after each request,
        # preventing the connection-pool memory leak.
        async with AsyncAnthropic() as client:
            messages = [{"role": "user", "content": prompt}]

            # Step 3: Run ReAct Loop
            return await _run_tool_loop(client, anthropic_tools, messages, av_client)

    except Exception as e:
        print(f"CRITICAL ERROR in query_alpha_bot: {e}", flush=True)
        error_msg = str(e)
        if "credit balance is too low" in error_msg:
            return "**Alpha Bot is Unavailable:** We apologize, but Alpha Bot is currently experiencing high token usage. Please try again later."
        return f"System Error: {error_msg}"
        
def get_prompt(prompt_path):
    if not os.path.exists(prompt_path):
        current_app.logger.error(f"Prompt file not found: {prompt_path}")
        return None
    try:
        with open(prompt_path, 'r') as f:
            return f.read()
    except Exception as e:
        current_app.logger.error(f"Error reading prompt file: {e}")
        return None
        

@alphaBot_bp.route('/alphaBot', methods=['POST'])
def alphaBot_endpoint():
    return jsonify({"message": "AlphaBot is running"}), 200


@alphaBot_bp.route('/alphaBot/in_depth_analysis', methods=['POST'])
def get_in_depth_analysis():
    data = request.json
    stock_symbol = data.get("stock_symbol")
    if not stock_symbol:
        return jsonify({"error": "Stock symbol is required"}), 400

    cache_key = f"in_depth_analysis:{stock_symbol.upper()}"
    cached = cache.get(cache_key)
    if cached:
        return jsonify({"response": cached}), 200

    prompt = get_prompt(IN_DEPTH_PROMPT)
    if not prompt:
        return jsonify({"error": "Prompt not found"}), 404
    prompt = prompt.replace("{stock_symbol}", stock_symbol)

    try:
        response = asyncio.run(query_alpha_bot(prompt, False))
        if not response.startswith("**Alpha Bot is Unavailable:**") and not response.startswith("System Error:") and not response.startswith("Error:"):
            cache.set(cache_key, response, timeout=900)
        return jsonify({"response": response}), 200
    except Exception as e:
        current_app.logger.error(f"Error generating getting in-depth analysis: {e}")
        return jsonify({"error": "Failed to generate in-depth analysis"}), 500

@alphaBot_bp.route('/alphaBot/compare_analysis', methods=['POST'])
def get_compare_analysis():
    data = request.json

    stock_symbols = data.get("stock_symbols")
    equations = data.get("equations", {})
    scores = data.get("scores", {})

    if not stock_symbols:
        print("ERROR: Missing stock_symbols", flush=True)
        return jsonify({"error": "Stock symbols are required"}), 400

    # Create a deterministic hash of the custom dictionary so that algorithm changes break the cache
    eq_hash = hashlib.md5(json.dumps(equations, sort_keys=True).encode('utf-8')).hexdigest()
    symbols_key = "_".join(sorted(s.upper() for s in stock_symbols))
    cache_key = f"compare_analysis:{symbols_key}:{eq_hash}"
    cached = cache.get(cache_key)
    if cached:
        return jsonify({"response": cached}), 200

    prompt = get_prompt(COMPARE_PROMPT)
    if not prompt:
        return jsonify({"error": "Prompt not found"}), 404
    prompt = prompt.replace("{stock_symbols}", ", ".join(stock_symbols))

    market_context = "<market_data>\n"

    market_context += "=== USER'S CUSTOM ALGORITHMS ===\n"
    market_context += f"{json.dumps(equations, indent=2)}\n\n"
    market_context += "=== RESULTING SCORES (0-100, Higher is Better) ===\n"
    market_context += f"{json.dumps(scores, indent=2)}\n\n"

    for symbol in stock_symbols:
        stock = StockMaster.query.filter_by(symbol=symbol).first()
        if stock:

            market_context += f"Data for {symbol}:\n"
            
            # Serialize the new flat metrics structure
            stock_data = stock.to_dict()
            # Remove giant nested fields we don't want bloating the overview
            stock_data.pop('news_sentiment_data', None)
            stock_data.pop('income_statement', None)
            stock_data.pop('cash_flow_history', None)
            
            market_context += f"METRICS: {json.dumps(stock_data, default=str)}\n"
            # Explicitly decode the volume for the LLM
            volume = stock.insider_volume or 0
            if volume > 0:
                direction = "NET BUYING (Positive Signal)"
            elif volume < 0:
                direction = "NET SELLING (Negative Signal)"
            else:
                direction = "NEUTRAL (No Signal / No Data)"
                
            market_context += f"INSIDER_TRANSACTION_VOLUME: {volume:,.0f} shares ({direction})\n"
            market_context += "---\n"
        else:
            market_context += f"Data for {symbol}: NOT FOUND IN CACHE\n---\n"
    market_context += "</market_data>\n\n"
    prompt = prompt + market_context
    
    try:
        response = asyncio.run(query_alpha_bot(prompt, False))
        if not response.startswith("**Alpha Bot is Unavailable:**") and not response.startswith("System Error:") and not response.startswith("Error:"):
            cache.set(cache_key, response, timeout=900)
        return jsonify({"response": response}), 200
    except Exception as e:
        current_app.logger.error(f"Error generating compare analysis: {e}")
        return jsonify({"error": "Failed to generate compare analysis"}), 500

@alphaBot_bp.route('/alphaBot/user_query', methods=['POST'])
def get_user_query():
    data = request.json
    user_query = data.get("user_query")
    stock_symbol = data.get("stock_symbol")
    if not user_query:
        return jsonify({"error": "User query is required"}), 400
    prompt = get_prompt(USER_QUERY_PROMPT)
    if not prompt:
        return jsonify({"error": "Prompt not found"}), 404
    prompt = prompt.replace("{stock_symbol}", stock_symbol)
    prompt = prompt.replace("{user_query}", user_query)
    try:
        response = asyncio.run(query_alpha_bot(prompt, True))
        return jsonify({"response": response}), 200
    except Exception as e:
        current_app.logger.error(f"Error generating generating user query response: {e}")
        return jsonify({"error": "Failed to generate response for user query"}), 500


@alphaBot_bp.route('/alphaBot/event_pulse', methods=['POST'])
def get_event_pulse_analysis():
    data = request.json
    stock_symbol = data.get("stock_symbol")
    timestamp = data.get("timestamp")
    date_str = data.get("date_str")
    price = data.get("price")
    swing_type = data.get("swing_type", "event")
    start_date_str = data.get("start_date_str", "")
    start_price = data.get("start_price", 0)
    
    if not stock_symbol or not timestamp:
        return jsonify({"error": "Stock symbol and timestamp are required"}), 400

    cache_key = f"event_pulse:{stock_symbol.upper()}:{timestamp}:{swing_type}:{start_date_str}"
    cached = cache.get(cache_key)
    if cached:
        return jsonify({"response": cached}), 200

    prompt = get_prompt(EVENT_PULSE_PROMPT)
    if not prompt:
        return jsonify({"error": "Prompt not found"}), 404
        
    prompt = prompt.replace("{stock_symbol}", stock_symbol)
    prompt = prompt.replace("{timestamp}", str(timestamp))
    prompt = prompt.replace("{date_str}", str(date_str))
    prompt = prompt.replace("{price}", str(price))
    prompt = prompt.replace("{swing_type}", str(swing_type))
    prompt = prompt.replace("{start_date_str}", str(start_date_str))
    prompt = prompt.replace("{start_price}", str(start_price))
    
    try:
        # include_tools=True activates the Alpha Vantage MCP to allow Claude to pull live forensic data!
        response = asyncio.run(query_alpha_bot(prompt, True))
        if not response.startswith("**Alpha Bot is Unavailable:**") and not response.startswith("System Error:") and not response.startswith("Error:"):
            cache.set(cache_key, response, timeout=3600)
        return jsonify({"response": response}), 200
    except Exception as e:
        current_app.logger.error(f"Error generating Event Pulse analysis: {e}")
        return jsonify({"error": "Failed to generate Event Pulse analysis"}), 500



def get_news_analysis(stock):

    prompt = get_prompt(NEWS_ANALYSIS_PROMPT)
    if not prompt:
        raise ValueError("News analysis prompt not found")

    # Inject data into prompt
    prompt = prompt.replace('{symbol}', stock.symbol)
    news_data_string = json.dumps(stock.news_sentiment_data) if stock.news_sentiment_data else "No recent news."
    prompt = prompt.replace('{news_json}', news_data_string)

    try:
        response_text = asyncio.run(query_alpha_bot(prompt, False))
        try:
            # Strip markdown codeblocks if Claude includes them
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean_text)
        except json.JSONDecodeError:
            print(f"Failed to parse news JSON: {response_text}", flush=True)
            return {"ai_news_score": 50, "ai_news_summary": "Analysis failed or unavailable."}
    except Exception as e:
        print(f"News Analysis Error for {stock.symbol}: {e}")
        return {"ai_news_score": 50, "ai_news_summary": "Analysis failed or unavailable."}

def get_moat_analysis(stock):

    prompt = get_prompt(MOAT_ANALYSIS_PROMPT)
    if not prompt:
        raise ValueError("Moat analysis prompt not found")
    # Inject data into prompt
    prompt = prompt.replace('{company_name}', str(stock.name or ""))
    prompt = prompt.replace('{symbol}', str(stock.symbol or ""))
    prompt = prompt.replace('{description}', str(stock.description or ""))
    prompt = prompt.replace('{operating_margin}', str(stock.operating_margin))
    prompt = prompt.replace('{profit_margin}', str(stock.profit_margin))
    prompt = prompt.replace('{roe}', str(stock.roe))
    prompt = prompt.replace('{free_cash_flow}', str(stock.free_cash_flow))
    prompt = prompt.replace('{market_cap}', str(stock.market_cap))

    try:
        response_text = asyncio.run(query_alpha_bot(prompt, False))
        try:
            # Strip markdown codeblocks if Claude includes them
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean_text)
        except json.JSONDecodeError:
            print(f"Failed to parse moat JSON: {response_text}", flush=True)
            return {"ai_moat_score": 50, "ai_moat_summary": "Analysis failed or unavailable."}
    except Exception as e:
        print(f"Moat Analysis Error for {stock.symbol}: {e}")
        return {"ai_moat_score": 50, "ai_moat_summary": "Analysis failed or unavailable."}

