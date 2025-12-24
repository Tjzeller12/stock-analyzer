

## 1. Overview
### Purpose
The Stock Comparison Feature enables users to filter and select stocks from their existing portfolio table, then generate AI-driven comparisons including rankings and explanations. This builds on the current portfolio system, focusing on manual selection for the MVP. Comparisons will provide a large body of text with stock rankings and reasoning, leveraging Grok for analysis. Responses will be saved for future tuning and analysis.

### Scope
- **Initial MVP**: User filters their portfolio table (e.g., by country, industry, sector, market cap range), selects 2-10 stocks, and requests an AI comparison. Data freshness is checked (use if <3 months old; assume refresh is handled via existing button). Prompt Grok with selected stocks for a ranked analysis with explanations.
- **Assumptions**: 
  - Portfolio table is already implemented with stocks and data from Alpha Vantage.
  - Existing refresh button handles data updates.
  - Limit to 2-10 stocks per comparison to keep prompts focused (enforce with UI feedback).
- **Out of Scope for MVP**: Automated peer discovery or suggestions; these are noted as future ideas.

### Goals
- Enhance the portfolio table with filtering and selection for quick comparisons.
- Deliver insightful rankings/explanations in a text-based response.
- Save comparison histories for performance analysis and tuning.

## 2. User Flow
1. **Access the Feature**: From the existing portfolio table view.
2. **Filter the Table**: User applies filters (e.g., country, industry, sector, market cap range) via UI elements like dropdowns/sliders. Each filter change triggers a backend request: Query the DB for matching user stocks, return the filtered list to the frontend for table display.
3. **Select Stocks**: Add selection mechanism (e.g., checkboxes) to the table. Limit to 2-10 stocks (UI warns if outside range).
4. **Generate Comparison**: User clicks a button like "Compare Stocks with AI Analysis."
   - Frontend creates a JSON list of selected stocks/symbols.
   - Send JSON to backend.
   - Backend appends the list to a pre-crafted prompt (stored in a markdown file).
   - Send complete prompt to Grok API.
   - Grok returns response: A large body of text with stock rankings (e.g., 1-10 based on overall strength) and explanations (e.g., why one ranks higher in growth, risks, etc.).
   - Backend saves the response (e.g., in DB or file) linked to the user/session for later analysis.
   - Send response to frontend for display (e.g., as formatted text).
5. **View and Interact**: Display the ranking/explanation text. Allow viewing saved history for past comparisons.

### Example User Scenario
- User filters table to US tech stocks with market cap >$1B.
- Selects AAPL, MSFT, GOOGL.
- Clicks "Compare Stocks with AI Analysis."
- Receives text: "Ranking: 1. AAPL (strong innovation edge), 2. MSFT (diversified revenue), 3. GOOGL (ad dominance but regulatory risks). Explanations: [detailed reasoning based on metrics and knowledge]."

## 3. Data Handling
- **Freshness Check**: For selected stocks, use DB data if <3 months old; rely on existing refresh button if needed.
- **Saving History**: Store each comparison response (prompt + Grok output) in DB or file, timestamped with user ID and selected stocks. This allows tuning (e.g., analyze response quality, refine prompts).

## 4. Potential Future Additions
These ideas expand on the MVP but are out of scope for now.

### Idea 1: Automated Peer Discovery
- Integrate APIs like Financial Modeling Prep (FMP) screener for global peers based on filters (e.g., sector, industry, market cap without country limits).
- Suggest peers to add to the selection list.

### Idea 2: Grok-Driven Peer Suggestions
- Before or after selection, prompt Grok: "Suggest up to 10 similar/competitive stocks to [selected symbols], focusing on global matches like Apple vs. Samsung."
- Display suggestions; user can add them to the table/selection if desired.
- Pros: Leverages Grok's knowledge for quick, relevant ideas without extra APIs.

### Idea 3: Hybrid Enhancements
- Combine manual filtering with auto-suggestions.
- Export saved histories or allow re-running with tweaks.

## 5. Risks and Mitigations
- **Large Responses**: Grok outputs may be verbose; format with headings/bullets on frontend.
- **Filter Overload**: If queries return too many stocks, add pagination to the table.
- **Performance**: Backend DB queries on filter changes—optimize with indexing.
- **User Adoption**: Start simple; use saved histories to iterate on prompt quality.

This design captures the core idea while keeping it aligned with your existing setup. If you want to expand on any section, let me know!