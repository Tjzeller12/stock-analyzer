"""
app.alphaBot package
--------------------
Public surface that the rest of the app imports from.

    from app.alphaBot import alphaBot_bp           # registered in app factory
    from app.alphaBot import get_news_analysis     # called from stock_manager
    from app.alphaBot import get_moat_analysis     # called from stock_manager
    from app.alphaBot import MarketDataProvider    # for custom provider injection
"""
from app.alphaBot.blueprint import alphaBot_bp
from app.alphaBot.analysis import get_news_analysis, get_moat_analysis
from app.alphaBot.providers import MarketDataProvider

__all__ = ["alphaBot_bp", "get_news_analysis", "get_moat_analysis", "MarketDataProvider"]
