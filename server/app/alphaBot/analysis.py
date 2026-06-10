"""
Structured AI Analyses
----------------------
Base class and concrete implementations for AI analyses that return
structured JSON (news sentiment score, moat score, etc.).

Adding a new analysis:
    1. Subclass StructuredAlphaBotAnalysis.
    2. Set prompt_path to your .md file constant.
    3. Implement build_placeholders() and default_result().
    4. Call MyAnalysis().analyze(stock) anywhere in the app.
"""
import json
from abc import ABC, abstractmethod

from app.alphaBot.client import AlphaBotClient
from app.alphaBot.prompt import PromptTemplate, PromptNotFoundError
from app.constants import NEWS_ANALYSIS_PROMPT, MOAT_ANALYSIS_PROMPT
from app.models import StockMaster


class StructuredAlphaBotAnalysis(ABC):
    """
    Base class for AI calls that must return a structured JSON dict.

    Subclasses only need to declare the prompt path and implement two
    methods — the shared error handling, JSON parsing, and LLM call are
    inherited.
    """

    prompt_path: str

    @abstractmethod
    def build_placeholders(self, stock: StockMaster) -> dict:
        """Return the {token: value} mapping for PromptTemplate.render()."""

    @abstractmethod
    def default_result(self) -> dict:
        """Return a safe fallback dict when the analysis fails or JSON parse fails."""

    def analyze(self, stock: StockMaster) -> dict:
        """Run the full analysis pipeline and always return a dict."""
        try:
            prompt = PromptTemplate.load(self.prompt_path).render(
                **self.build_placeholders(stock)
            )
            result = AlphaBotClient.run_sync(prompt, include_tools=False)
            return self._parse_json(result.text, stock)
        except PromptNotFoundError as e:
            print(f"{self.__class__.__name__} prompt missing for {stock.symbol}: {e}", flush=True)
            return self.default_result()
        except Exception as e:
            print(f"{self.__class__.__name__} Error for {stock.symbol}: {e}", flush=True)
            return self.default_result()

    def _parse_json(self, text: str, stock: StockMaster) -> dict:
        try:
            clean = text.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except json.JSONDecodeError:
            print(
                f"{self.__class__.__name__}: failed to parse JSON for {stock.symbol}: {text}",
                flush=True,
            )
            return self.default_result()


# ------------------------------------------------------------------ #
# Concrete analyses                                                    #
# ------------------------------------------------------------------ #

class NewsAnalysis(StructuredAlphaBotAnalysis):
    prompt_path = NEWS_ANALYSIS_PROMPT

    def build_placeholders(self, stock: StockMaster) -> dict:
        news_data = (
            json.dumps(stock.news_sentiment_data)
            if stock.news_sentiment_data
            else "No recent news."
        )
        return {"symbol": stock.symbol, "news_json": news_data}

    def default_result(self) -> dict:
        return {"ai_news_score": 50, "ai_news_summary": "Analysis failed or unavailable."}


class MoatAnalysis(StructuredAlphaBotAnalysis):
    prompt_path = MOAT_ANALYSIS_PROMPT

    def build_placeholders(self, stock: StockMaster) -> dict:
        return {
            "company_name":    str(stock.name or ""),
            "symbol":          str(stock.symbol or ""),
            "description":     str(stock.description or ""),
            "operating_margin": str(stock.operating_margin),
            "profit_margin":    str(stock.profit_margin),
            "roe":              str(stock.roe),
            "free_cash_flow":   str(stock.free_cash_flow),
            "market_cap":       str(stock.market_cap),
        }

    def default_result(self) -> dict:
        return {"ai_moat_score": 50, "ai_moat_summary": "Analysis failed or unavailable."}


# ------------------------------------------------------------------ #
# Module-level convenience functions (backwards-compatible API)        #
# ------------------------------------------------------------------ #

def get_news_analysis(stock: StockMaster) -> dict:
    return NewsAnalysis().analyze(stock)


def get_moat_analysis(stock: StockMaster) -> dict:
    return MoatAnalysis().analyze(stock)
