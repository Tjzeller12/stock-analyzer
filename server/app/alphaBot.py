from flask import Blueprint, request, jsonify, current_app
from app import cache
import requests
import os
from app.constants import ALPHA_VANTAGE_MCP_URL, CLAUDE_MODEL, USER_QUERY_PROMPT, COMPARE_PROMPT, IN_DEPTH_PROMPT
from app.utils.api import build_alpha_vantage_url
from app.constants import AlphaVantageFunction
from anthropic import AsyncAnthropic
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
    Iterates through Claude's response content, executes any requested tools,
    and returns the results formatted as a list of user messages.
    
    Args:
        av_client (HttpMCPClient): The initialized MCP client.
        tool_calls (list): The 'content' list from Claude's response.
        
    Returns:
        list: A list of result messages to append to the conversation history.
    """
    tool_results = []
    for content in tool_calls:
        if content.type == "tool_use":
            tool_name = content.name
            tool_args = content.input
            
            try:
                # 3. Execute the tool via our custom MCP client
                tool_result_content = await av_client.call_tool(tool_name, tool_args)
                
                # 4. Format the result text
                tool_output = ""
                for block in tool_result_content:
                    if block.get("type") == "text":
                        tool_output += block.get("text", "")
                    else:
                        tool_output += str(block)
                
            except Exception as e:
                # Log error but don't crash - let Claude know the tool failed
                print(f"ERROR: Tool execution failed: {e}", flush=True)
                tool_output = f"Error executing tool {tool_name}: {str(e)}"
                
            # 5. Pack the result into a 'tool_result' block for Claude
            tool_results.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": content.id,
                    "content": tool_output
                }]
            })
    return tool_results

async def _run_tool_loop(client, anthropic_tools, messages, av_client):
    """
    The main 'ReAct' loop (Reason + Act).
    
    1. Sends history to Claude.
    2. Checks if Claude wants to stop or use a tool.
    3. If tool use: executes tools -> adds results to history -> repeats loop.
    4. If stop: returns the final text response.
    """
    for i in range(50): # Safety limit to prevent infinite loops (cost protection)
        response = await client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4000,
            messages=messages,
            tools=anthropic_tools
        )
        
        # Add Claude's "thought" (or tool request) to history
        messages.append({"role": "assistant", "content": response.content})
        
        # Exit condition: Claude has finished its analysis
        if response.stop_reason != "tool_use":
            return response.content[0].text
        
        # If we are here, Claude wants to use tools. Execute them.
        tool_results = await _execute_tool_calls(av_client, response.content)
        messages.extend(tool_results)
    
    return "Analysis timed out or reached max turns."

async def query_alpha_bot(prompt):
    """Main entry point for AlphaBot queries."""
    # helper for api key
    api_key = os.getenv('ALPHA_VANTAGE_KEY')
    if not api_key:
        print("ERROR: Missing ALPHA_VANTAGE_KEY", flush=True)
        return "Error: Backend missing configuration."

    # Use our custom HTTP client
    av_client = HttpMCPClient(ALPHA_VANTAGE_MCP_URL, api_key)
    
    try:
        # Step 1: Discover tools
        anthropic_tools = await _discover_tools(av_client)
        
        # Step 2: Initialize Client
        client = AsyncAnthropic()
        messages = [{"role": "user", "content": prompt}]
        
        # Step 3: Run ReAct Loop
        return await _run_tool_loop(client, anthropic_tools, messages, av_client)
        
    except Exception as e:
        print(f"CRITICAL ERROR in query_alpha_bot: {e}", flush=True)
        return f"System Error: {str(e)}"
        
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


@cache.memoize(timeout=900)
@alphaBot_bp.route('/alphaBot/in_depth_analysis', methods=['POST'])
def get_in_depth_analysis():
    data = request.json
    stock_symbol = data.get("stock_symbol")
    if not stock_symbol:
        return jsonify({"error": "Stock symbol is required"}), 400

    prompt = get_prompt(IN_DEPTH_PROMPT)
    if not prompt:
        return jsonify({"error": "Prompt not found"}), 404
    prompt = prompt.replace("{stock_symbol}", stock_symbol)

    try:
        response = asyncio.run(query_alpha_bot(prompt))
        return jsonify({"response": response}), 200
    except Exception as e:
        current_app.logger.error(f"Error generating getting in-depth analysis: {e}")
        return jsonify({"error": "Failed to generate in-depth analysis"}), 500

# @cache.memoize(timeout=900)
@alphaBot_bp.route('/alphaBot/compare_analysis', methods=['POST'])
def get_compare_analysis():
    data = request.json

    stock_symbols = data.get("stock_symbols")

    if not stock_symbols:
        print("ERROR: Missing stock_symbols", flush=True)
        return jsonify({"error": "Stock symbols are required"}), 400
    prompt = get_prompt(COMPARE_PROMPT)
    if not prompt:
        return jsonify({"error": "Prompt not found"}), 404
    prompt = prompt.replace("{stock_symbols}", ", ".join(stock_symbols))

    try:
        response = asyncio.run(query_alpha_bot(prompt))
        return jsonify({"response": response}), 200
    except Exception as e:
        current_app.logger.error(f"Error generating compare analysis: {e}")
        return jsonify({"error": "Failed to generate compare analysis"}), 500

@cache.memoize(timeout=900)
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
        response = asyncio.run(query_alpha_bot(prompt))
        return jsonify({"response": response}), 200
    except Exception as e:
        current_app.logger.error(f"Error generating generating user query response: {e}")
        return jsonify({"error": "Failed to generate response for user query"}), 500
