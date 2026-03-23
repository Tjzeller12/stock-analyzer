import os

"""Constants used throughout the application."""

# External API URLs
ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"
FINANCIAL_MODELING_PREP_BASE_URL = "https://financialmodelingprep.com/api/v3"
ALPHA_VANTAGE_MCP_URL = "https://mcp.alphavantage.co/mcp"
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

# Prompt file paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IN_DEPTH_PROMPT = os.path.join(BASE_DIR, "prompts/in_depth.md")
COMPARE_PROMPT = os.path.join(BASE_DIR, "prompts/compare.md")
USER_QUERY_PROMPT = os.path.join(BASE_DIR, "prompts/user_query.md")
EVENT_PULSE_PROMPT = os.path.join(BASE_DIR, "prompts/event_pulse.md")
NEWS_ANALYSIS_PROMPT = os.path.join(BASE_DIR, "prompts/news_analysis.md")
MOAT_ANALYSIS_PROMPT = os.path.join(BASE_DIR, "prompts/moat_analysis.md")

# Scope types for Radar stats

GLOBAL = 'global'
SECTOR = 'sector'
INDUSTRY = 'industry'

# Metrics used for Radar Chart normalization and equations
RADAR_METRICS = [
    'price', 'market_cap', 'total_assets', 'total_liabilities', 
    'operating_cash_flow', 'capital_expenditures', 'free_cash_flow', 'buy_ratings_count',
    'pe_ratio', 'forward_pe', 'peg_ratio', 'ev_to_ebitda', 'price_to_sales', 
    'price_to_book', 'price_to_fc', 'dividend_yield', 'roe', 'roa', 
    'operating_margin', 'profit_margin', 'roic', 'rev_growth_qoq', 
    'eps_growth_qoq', 'debt_to_equity', 'beta', 'insider_volume',
    'ai_news_score', 'ai_moat_score'
]


# Internal API Routes
class Routes:
    # Auth routes
    AUTH_LOGOUT = "/auth/logout"
    
    # Portfolio routes
    PORTFOLIO_ADD = "/portfolio/add"
    PORTFOLIO_REMOVE = "/portfolio/remove"
    PORTFOLIO_REFRESH = "/portfolio/refresh"
    
    # Data routes
    DATA_STOCK = "/data/stock_data"
    DATA_NEWS = "/data/news"
    DATA_IN_DEPTH = "/data/in_depth_data"
    DATA_CHART = "/data/chart_data"
    
    # AlphaBot routes
    ALPHA_BOT = "/alphaBot"
    ALPHA_BOT_COMPARE = "/alphaBot/compare_analysis"
    ALPHA_BOT_IN_DEPTH = "/alphaBot/in_depth_analysis"
    ALPHA_BOT_USER_QUERY = "/alphaBot/user_query"
    ALPHA_BOT_EVENT_PULSE = "/alphaBot/event_pulse"

# Alpha Vantage API Functions
class AlphaVantageFunction:
    NEWS_SENTIMENT = "NEWS_SENTIMENT"
    GLOBAL_QUOTE = "GLOBAL_QUOTE"
    TIME_SERIES_DAILY = "TIME_SERIES_DAILY"
    TIME_SERIES_DAILY_ADJUSTED = "TIME_SERIES_DAILY_ADJUSTED"
    TIME_SERIES_INTRADAY = "TIME_SERIES_INTRADAY"
    TIME_SERIES_INTRADAY = "TIME_SERIES_INTRADAY"
    TIME_SERIES_MONTHLY = "TIME_SERIES_MONTHLY"
    INSIDER_TRANSACTIONS = "INSIDER_TRANSACTIONS"
    OVERVIEW = "OVERVIEW"
    INCOME_STATEMENT = "INCOME_STATEMENT"
    CASH_FLOW = "CASH_FLOW"
    BALANCE_SHEET = "BALANCE_SHEET"

# Financial Modeling Prep API Endpoints
class FinancialModelingEndpoint:
    CASH_FLOW_STATEMENT = "cash-flow-statement"
    BALANCE_SHEET_STATEMENT = "balance-sheet-statement"
    KEY_METRICS = "key-metrics"
