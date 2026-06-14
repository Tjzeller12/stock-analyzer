# Stock Market Analyzer (AlphaBot)
 
A full-stack web application for analyzing stocks, tracking portfolios, and staying updated with financial news. Built with a React/TypeScript frontend and a Flask/Python backend, with AI-powered analysis via Anthropic's Claude and the Alpha Vantage MCP server.
 
---
 
## Features
 
### Portfolio Management
- Add and remove stocks from a personal portfolio
- View comprehensive stock data including price, EV/EBITDA, P/E, market cap, dividend yield, free cash flow, debt-to-equity, ROIC, price-to-FCF, and cash equivalents
- Sort and filter stocks by various financial metrics
- Real-time portfolio refresh via Alpha Vantage API
### Custom Radar Scoring Engine
- Build custom quantitative scoring templates using a formula builder (CodeMirror editor with live syntax validation)
- Six configurable scoring axes: Valuation, Growth, Stability, Sentiment, Efficiency, Insider Confidence
- Min-Max and Z-Score normalization modes
- Global, sector, and industry peer comparison scopes
- Per-stock radar chart displayed in the portfolio table with color-coded health indicators (green/yellow/red)
### AI-Powered Analysis (AlphaBot)
- In-depth single stock analysis using Claude (Anthropic) with Alpha Vantage MCP tool access
- Stock comparison analysis with AI-generated rankings, reasoning, and portfolio allocation suggestions
- Interactive stock chat: ask arbitrary questions about any stock in your portfolio
- Event Pulse: click any date range on a stock's historical chart to trigger a forensic AI analysis of what drove the move (earnings, sector correlation, market noise, etc.)
- AI Moat Score and AI News Score automatically generated when a stock is added to the portfolio
### News Aggregation
- Curated financial news from multiple sources via Alpha Vantage
- Filterable by category: Blockchain, Earnings, IPO, Mergers & Acquisitions, Financial Markets, Economy (Fiscal/Monetary/Macro), Technology, Manufacturing, Energy, and more
- News cached to reduce API usage
### Stock Details Page
- In-depth financial metrics organized by category (Valuation, Profitability, Cash Flow, Balance Sheet, Growth, Market, Analyst Ratings, AI Scores)
- Interactive stock price chart (Lightweight Charts) with support for 1D, 1W, 1M, 3M, 6M, 1Y, 5Y, and MAX timeframes
- Event Pulse selection tool for AI forensic analysis of specific price windows
- Buy/Hold/Sell analyst rating counts
- Per-stock radar graph
- AlphaBot summary and chat panel
### User Features
- Secure authentication with JWT (register, login, logout)
- User profile with password reset
- Dark/Light theme toggle (persisted via localStorage)
---
 
## Tech Stack
 
### Frontend
- React 18 with TypeScript
- Vite for bundling
- Tailwind CSS v4 for styling
- React Router v6 for navigation
- Axios for API communication
- AG Grid (Community) for the portfolio table
- Lightweight Charts (TradingView) for stock price charts
- Recharts for radar and doughnut charts
- react-markdown with remark-gfm for rendering AI responses
- CodeMirror with mathjs for the formula builder
### Backend
- Flask (Python) REST API
- PostgreSQL with SQLAlchemy ORM and Flask-Migrate
- Redis-backed Flask-Caching (simple cache in development)
- JWT authentication via PyJWT
- Flask-Bcrypt for password hashing
- Flask-CORS
- Anthropic Python SDK for Claude integration
- httpx for async HTTP (MCP client)
- asteval for sandboxed formula evaluation
- NumPy for normalization statistics
### External APIs
- Alpha Vantage — stock data, news sentiment, insider transactions, time series
- Alpha Vantage MCP Server — tool-use interface for Claude's agentic analysis
- Financial Modeling Prep — supplemental in-depth financials
- Anthropic (Claude Sonnet) — AI analysis, comparison, event forensics, moat scoring, news scoring
### Infrastructure
- Docker Compose with separate containers for frontend (Nginx), backend (Flask), and database (PostgreSQL)
---
 
## Project Structure
 
```
├── client/                        # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/            # EventPulseChart, ForensicAnalysisPanel
│   │   │   └── common/            # StockTable, RadarGraph, DoughnutChart, Card, Header, etc.
│   │   ├── constants/             # API endpoints, chart colors, filter options, radar metrics
│   │   ├── hooks/                 # useStockTableManager, useCompareAlphaBotManager, useEventPulseManager, etc.
│   │   ├── pages/                 # App, LoginPage, RegisterPage, MainPage, StockPage, Profile
│   │   ├── types.ts               # Shared TypeScript interfaces
│   │   └── utils/                 # authPost/authGet helpers, formatters
│   └── public/
│
└── server/                        # Flask backend
    ├── app/
    │   ├── routes/                # auth, portfolio, stock_data, profile, radar
    │   ├── services/              # alpha_api, stock_manager, score_engine, news_manager
    │   ├── utils/                 # api (URL builders), normalization
    │   ├── prompts/               # Markdown prompt templates for Claude
    │   ├── models.py              # SQLAlchemy models
    │   ├── constants.py           # API constants, metric lists, prompt paths
    │   └── alphaBot.py            # Claude MCP integration and AlphaBot routes
    ├── tests/                     # pytest integration and unit tests
    ├── migrations/                # Flask-Migrate / Alembic migrations
    ├── config.py
    └── run.py
```
 
---
 
## API Endpoints
 
### Authentication
- `POST /auth/register` — Register new user
- `POST /auth/login` — Login, returns JWT
- `POST /auth/logout` — Logout
- `GET /auth/@me` — Get current user
### Portfolio
- `POST /portfolio/add` — Add stock to portfolio
- `POST /portfolio/remove` — Remove stock from portfolio
- `POST /portfolio/refresh` — Refresh all portfolio stock data from Alpha Vantage
- `POST /portfolio/stocks` — Get sorted portfolio stocks
### Stock Data
- `POST /data/stock_data` — Get stock details
- `POST /data/news` — Get filtered news feed
- `POST /data/in_depth_data` — Get supplemental financials from FMP
- `POST /data/chart_data` — Get time series chart data
### Radar Scoring
- `POST /radar/single` — Calculate radar scores for one stock
- `POST /radar/compare` — Calculate cross-normalized radar scores for multiple stocks
### Profile
- `POST /profile/info` — Get user info
- `POST /profile/save` — Update profile
- `POST /profile/reset` — Reset password
### AlphaBot
- `POST /alphaBot/in_depth_analysis` — Generate AI deep-dive for a stock
- `POST /alphaBot/compare_analysis` — Generate AI comparison across selected stocks
- `POST /alphaBot/user_query` — Answer a freeform user question about a stock
- `POST /alphaBot/event_pulse` — Forensic AI analysis of a specific price window
---
 
## Database Schema
 
| Table | Description |
|---|---|
| `User` | User accounts |
| `Portfolio` | One-to-one with User |
| `StockMaster` | Shared stock data cache across all users |
| `Stock` | Portfolio-to-StockMaster join |
| `StockNews` | Per-stock news summary and sentiment scores |
| `GeneralStockNews` | Filtered general news articles |
| `Filter` | News filter category registry |
| `MarketStats` | Pre-computed normalization stats (global, sector, industry) |
| `AnalysisTemplate` | Stored radar scoring templates |
 
---
 
## Caching Strategy
- Stock prices: 15-minute cache
- Stock data and news: 15-minute memoize cache
- AlphaBot in-depth analysis: 15-minute cache per symbol
- AlphaBot compare analysis: 15-minute cache keyed by symbols and equation hash
- Event Pulse analysis: 1-hour cache per symbol/timestamp/swing type
---
 
## Running the Project
 
Copy `.env.example` to `.env` in the `server/` directory and supply:
- `SECRET_KEY`
- `DATABASE_URL`
- `ALPHA_VANTAGE_KEY`
- `ANTHROPIC_API_KEY`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `APP_HOST`
Then start all services with Docker Compose:
 
```bash
docker-compose up --build
```
 
To reset the database:
```bash
./reset-database.sh
```
 
---
 
## Testing
 
### Backend (pytest)
```bash
cd server
pytest tests/
```
 
Test modules cover: auth routes, portfolio routes, stock data routes, radar scoring routes, profile routes, AlphaBot routes, the score engine math, and async tool execution speed.
 
### Frontend (Vitest)
```bash
cd client
npm test
```
 
Test modules cover: page components (Login, Register, Main, Stock, Profile), custom hooks (useEventPulseManager, useCompareAlphaBotManager, useStockDataManager, useStockAnalysisManager, useNewsListManager, useStockTableManager), and chart components (EventPulseChart, ForensicAnalysisPanel).
 
---
 
## Notes
- API keys for Alpha Vantage, Anthropic, and Financial Modeling Prep must be configured before running.
- The Alpha Vantage free tier has rate limits; some features (chart data, refresh) may return 429 errors under heavy use.
- AI analysis runs asynchronously in a background thread when a stock is first added to the portfolio.
