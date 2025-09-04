"""Constants used throughout the application."""

# External API URLs
HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/ProsusAI/finbert"
ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"
FINANCIAL_MODELING_PREP_BASE_URL = "https://financialmodelingprep.com/api/v3"
GROK_BASE_URL = "https://api.x.ai/v1"

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
    
    # AlphaBot routes
    ALPHA_BOT = "/alphaBot"
    ALPHA_BOT_SENTIMENT = "/alphaBot/article_sentiment"
    ALPHA_BOT_NEWS_SUMMARY = "/alphaBot/news_summary"

# Alpha Vantage API Functions
class AlphaVantageFunction:
    NEWS_SENTIMENT = "NEWS_SENTIMENT"
    GLOBAL_QUOTE = "GLOBAL_QUOTE"
    TIME_SERIES_DAILY = "TIME_SERIES_DAILY"
    TIME_SERIES_INTRADAY = "TIME_SERIES_INTRADAY"
    OVERVIEW = "OVERVIEW"

# Financial Modeling Prep API Endpoints
class FinancialModelingEndpoint:
    CASH_FLOW_STATEMENT = "cash-flow-statement"
    BALANCE_SHEET_STATEMENT = "balance-sheet-statement"
    KEY_METRICS = "key-metrics"
