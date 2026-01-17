# Stock Analyzer - Project Status & Implementation Plan

## Project Summary
Integration of **Claude (via Anthropic API)** and **Alpha Vantage MCP Server** to provide intelligent financial analysis. The backend now acts as an MCP Client, allowing Claude to autonomously call Alpha Vantage tools to fetch and analyze stock data.

## Completed Work (Jan 17, 2026)

### Backend
- [x] **MCP Client Engine**: Implemented `HttpMCPClient` in `alphaBot.py` to bridge stateless HTTP requests with Alpha Vantage's JSON-RPC protocol.
- [x] **Endpoints Created**:
    - `/alphaBot/compare_analysis`: Accepts multiple symbols, returns comparative analysis.
    - `/alphaBot/in_depth_analysis`: Accepts single symbol, returns deep dive + sentiment.
    - `/alphaBot/user_query`: Handles custom user questions about stocks.
- [x] **Prompt Engineering**: Created structured prompts in `server/app/prompts/` (using correct SCREAMING_SNAKE_CASE tool names).

### Frontend
- [] **Dependencies**: Installed `react-markdown`, `chart.js`, `react-chartjs-2`, `remark-gfm` for future display needs.
- [x] **Reversion**: Cleaned up `StockPage.tsx` and `MainPage.tsx` to remove broken experimental components. The codebase is now stable and ready for UI implementation.
- [x] **Layout Fixes**: Fixed CSS issues in `MainPage` preventing the stock list from disappearing during analysis.

## Current Status
- **Backend:** Stable and Functional. Connects correctly to Claude and Alpha Vantage.
- **Frontend:** "Clean Slate". Analysis endpoints are called, but results are currently displayed as raw text.
- **Infrastructure:** Docker Compose config is updated with necessary API keys (`ANTHROPIC_API_KEY`).

## Remaining Tasks / Roadmap

### 1. Prompt Refinement (JSON Output)
- **Goal:** Instruct Claude to return responses in a structured JSON format (e.g., separating `markdown_text`, `graph_data`, `key_metrics_table`) instead of a single text blob.
- **Benefit:** Allows the frontend to render distinct components (Graphs, Tables) rather than just parsing massive markdown strings.

### 2. Frontend Implementation (In-Depth Analysis)
- **Container:** Create a dedicated display container on `StockPage` for analysis results.
- **Rendering:** Implement `MarkdownRenderer` to display the text beautifully.
- **Visuals:** Implement `ChartRenderer` to visualize the JSON data (from task #1).

### 3. User Query Feature
- **Frontend:** Add an input field on `StockPage` to accept user questions.
- **Display:** Create a chat-like or response container to show Claude's answer to the specific question.

### 4. Bug Scanning & Fixes
- **Known Issue:** `POST /data/in_depth_data` returns `500 Internal Server Error`.
    - *Investigation:* Likely an issue with FMP API limits or error handling in `get_in_depth_financials`. Needs debugging.

### 5. UI/UX Polish
- Clean up the look of `MainPage` (Dashboard) and `StockPage`.
- Ensure styled, consistent typography and spacing for the new AI components.
