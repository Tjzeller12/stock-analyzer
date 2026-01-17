from flask import Blueprint, request, jsonify, current_app
from app import cache
import requests
import os
from app.constants import ALPHA_VANTAGE_MCP_URL, CLAUDE_MODEL, USER_QUERY_PROMPT, COMPARE_PROMPT, IN_DEPTH_PROMPT
from app.utils.api import build_alpha_vantage_url
from app.constants import AlphaVantageFunction
from anthropic import AsyncAnthropic
from mcp.client.sse import sse_client
from mcp.client.session import ClientSession
import asyncio

# Make alphaBot blueprint
alphaBot_bp = Blueprint('alphaBot', __name__)

import httpx

# Custom HTTP MCP Client to handle Alpha Vantage's JSON-RPC over HTTP POST
# LEARNING TIP: The Alpha Vantage server is stateless (HTTP POST). 
# Standard MCP uses stateful connections (SSE/WebSockets). 
# This class bridges that gap by wrapping our requests in the standard JSON-RPC 2.0 format 
# that the server expects, but sending them as individual POST requests.
class HttpMCPClient:
    def __init__(self, base_url, api_key):
        self.url = f"{base_url}?apikey={api_key}"
        self.request_id = 0
        
    async def call_method(self, method, params=None):
        # Rate limiting: wait 1.5s between requests to be safe (API allows ~1/sec)
        # await asyncio.sleep(1.5)
        self.request_id += 1
        # Construct the JSON-RPC envelope manually
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self.request_id
        }
        print(f"DEBUG: MCP Request: {method} - Payload: {payload}", flush=True)
        async with httpx.AsyncClient() as client:
            try:
                # We use a standard HTTP POST with the JSON-RPC payload
                resp = await client.post(self.url, json=payload, timeout=30.0)
                print(f"DEBUG: MCP Response Status: {resp.status_code}", flush=True)
                resp.raise_for_status()
                data = resp.json()
                
                if "error" in data:
                     print(f"DEBUG: MCP Protocol Error: {data['error']}", flush=True)
                     raise Exception(f"MCP Error: {data['error']}")
                return data.get("result", {})
            except Exception as e:
                print(f"DEBUG: MCP Connection Error: {str(e)}", flush=True)
                raise

    async def list_tools(self):
        print("DEBUG: Listing tools...", flush=True)
        res = await self.call_method("tools/list")
        tools = res.get("tools", [])
        print(f"DEBUG: Found {len(tools)} tools: {[t.get('name') for t in tools]}", flush=True)
        return tools

    async def call_tool(self, name, arguments):
         print(f"DEBUG: Calling tool {name} with args: {arguments}", flush=True)
         # In JSON-RPC, calling a tool is just another method 'tools/call'
         res = await self.call_method("tools/call", {"name": name, "arguments": arguments})
         content = res.get("content", [])
         print(f"DEBUG: Tool execution result: {str(content)[:200]}...", flush=True)
         return content

async def query_alpha_bot(prompt):
    print("DEBUG: Starting query_alpha_bot", flush=True)
    
    # helper for api key
    api_key = os.getenv('ALPHA_VANTAGE_KEY')
    if not api_key:
        print("DEBUG: Missing ALPHA_VANTAGE_KEY", flush=True)
        return "Error: Backend missing configuration."

    # Use our custom HTTP client
    av_client = HttpMCPClient(ALPHA_VANTAGE_MCP_URL, api_key)
    
    try:
        # Step 1: Discover what tools the server offers
        available_tools = await av_client.list_tools()
        
        # Step 2: Translate them to the format Claude understands
        anthropic_tools = []
        for tool in available_tools:
            anthropic_tools.append({
                "name": tool.get("name"),
                "description": tool.get("description"),
                "input_schema": tool.get("inputSchema")
            })
        
        print("DEBUG: Initializing Anthropic Client", flush=True)
        client = AsyncAnthropic()
        messages = [{"role": "user", "content": prompt}]
        
        # Step 3: Enter the "ReAct" loop (Reason + Act)
        # Claude reasons -> calls tool -> we execute tool -> return result -> Claude reasons again
        print("DEBUG: Entering tool loop", flush=True)
        for i in range(10): # Max turns to prevent infinite loops
            print(f"DEBUG: Turn {i+1}", flush=True)
            response = await client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=4000,
                messages=messages,
                tools=anthropic_tools
            )
            
            print(f"DEBUG: Claude Response Stop Reason: {response.stop_reason}", flush=True)
            
            # Save Claude's thought process to history
            messages.append({"role": "assistant", "content": response.content})
            
            # If Claude is done using tools, we're finished
            if response.stop_reason != "tool_use":
                print("DEBUG: Final response received", flush=True)
                return response.content[0].text
            
            # If Claude wants to use a tool, execute it
            for content in response.content:
                if content.type == "tool_use":
                    tool_name = content.name
                    tool_args = content.input
                    
                    try:
                        # Execute logic on our custom client
                        tool_result_content = await av_client.call_tool(tool_name, tool_args)
                        
                        # Format the result back into text for Claude
                        tool_output = ""
                        for block in tool_result_content:
                            if block.get("type") == "text":
                                tool_output += block.get("text", "")
                            else:
                                tool_output += str(block)
                        
                    except Exception as e:
                        print(f"ERROR: Tool execution failed: {e}", flush=True)
                        tool_output = f"Error executing tool {tool_name}: {str(e)}"
                        
                    # Feed the result back to Claude
                    messages.append({
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": content.id,
                            "content": tool_output
                        }]
                    })
        
        return "Analysis timed out or reached max turns."
        
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

@alphaBot_bp.route('/alphaBot/compare_analysis', methods=['POST'])
def get_compare_analysis():
    data = request.json
    print(f"DEBUG: Data received: {data}", flush=True)
    stock_symbols = data.get("stock_symbols")
    print(f"DEBUG: Stock Symbols: {stock_symbols}", flush=True)
    if not stock_symbols:
        print("DEBUG: Missing stock_symbols", flush=True)
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
