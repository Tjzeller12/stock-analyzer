"""
Payload Stripper — Strategy Pattern
-------------------------------------
Three-tier architecture:

  1. PayloadGoalStrategy (ABC)
     The contract every strategy must satisfy. Defines match_condition()
     for content-based autodetection and strip() for the transformation.

  2. Concrete Goal Strategies
     One class per data type (TimeSeriesStrategy, NewsStrategy, …).
     Each class is fully isolated — changing news stripping never
     touches balance-sheet stripping.

  3. UniversalPayloadStripper (Engine)
     Accepts any list of strategies and routes raw payloads through them.
     Knows nothing about Alpha Vantage specifically.

  4. AlphaVantagePayloadStripper (Facade)
     Backwards-compatible entry point used by client.py.
     Pre-registers all AV strategies so callers need zero changes.

Adding a new data vendor (e.g. SEC Edgar, Plaid):
    1. Write a new PayloadGoalStrategy subclass.
    2. Instantiate a UniversalPayloadStripper with your new strategies.
    Done — existing AV code is completely untouched.

Adding a new Alpha Vantage endpoint:
    1. Write a new PayloadGoalStrategy subclass.
    2. Add it to AlphaVantagePayloadStripper._STRATEGIES.
    Done — one line change.
"""
import json
from abc import ABC, abstractmethod


# ================================================================== #
# 1. Contract                                                          #
# ================================================================== #

class PayloadGoalStrategy(ABC):
    """
    Base class for all payload-stripping strategies.

    Subclasses must implement:
      target_keys     — list of tool-name substrings this strategy handles
                        (used as a name-based fallback when content detection fails)
      match_condition — returns True if the data dict looks like this strategy's
                        data type (content-based autodetection)
      strip           — performs the actual data transformation
    """

    @property
    @abstractmethod
    def target_keys(self) -> list[str]:
        """Tool-name keywords that identify this strategy (e.g. ['news', 'sentiment'])."""

    @abstractmethod
    def match_condition(self, data: dict) -> bool:
        """Return True if data's JSON structure matches this strategy."""

    @abstractmethod
    def strip(self, data: dict) -> dict:
        """Return a leaner version of data containing only what Claude needs."""


# ================================================================== #
# 2. Concrete Strategies                                               #
# ================================================================== #

class TimeSeriesStrategy(PayloadGoalStrategy):
    """Daily / weekly / monthly OHLCV price data."""

    target_keys = ["time_series_daily", "time_series_weekly",
                   "time_series_monthly", "intraday"]

    def match_condition(self, data: dict) -> bool:
        for key in data:
            key_lower = key.lower()
            if any(k in key_lower for k in ("time series", "weekly", "monthly", "intraday")):
                if isinstance(data[key], dict) and data[key] and \
                        isinstance(next(iter(data[key].values())), dict):
                    return True
        return False

    def strip(self, data: dict, max_entries: int = 30) -> dict:
        """
        Keep only the N most-recent trading days and reduce each OHLCV row
        to close + volume.  High/low/open add noise for swing classification.
        """
        result = {}
        for key, value in data.items():
            if isinstance(value, dict) and value and \
                    isinstance(next(iter(value.values())), dict):
                recent = dict(list(value.items())[:max_entries])
                result[key] = {
                    date: {
                        "close":  row.get("4. close") or row.get("5. adjusted close", ""),
                        "volume": row.get("5. volume") or row.get("6. volume", ""),
                    }
                    for date, row in recent.items()
                }
            else:
                result[key] = value
        return result


class NewsStrategy(PayloadGoalStrategy):
    """Alpha Vantage news sentiment feed."""

    target_keys = ["news", "sentiment"]

    def match_condition(self, data: dict) -> bool:
        return "feed" in data and isinstance(data.get("feed"), list)

    def strip(self, data: dict, max_articles: int = 5, summary_chars: int = 120) -> dict:
        """
        Limit to N articles and keep only the fields that matter for
        event correlation: title, publish time, truncated summary, sentiment scores.
        """
        articles = data.get("feed", [])[:max_articles]
        return {
            "items":                     data.get("items"),
            "sentiment_score_definition": data.get("sentiment_score_definition"),
            "relevance_score_definition": data.get("relevance_score_definition"),
            "feed": [
                {
                    "title":                   a.get("title"),
                    "time_published":          a.get("time_published"),
                    "summary":                 (a.get("summary") or "")[:summary_chars],
                    "source":                  a.get("source"),
                    "overall_sentiment_label": a.get("overall_sentiment_label"),
                    "overall_sentiment_score": a.get("overall_sentiment_score"),
                    "ticker_sentiment": [
                        {
                            "ticker":                 ts.get("ticker"),
                            "relevance_score":        ts.get("relevance_score"),
                            "ticker_sentiment_label": ts.get("ticker_sentiment_label"),
                            "ticker_sentiment_score": ts.get("ticker_sentiment_score"),
                        }
                        for ts in a.get("ticker_sentiment", [])[:4]
                    ],
                }
                for a in articles
            ],
        }


class OverviewStrategy(PayloadGoalStrategy):
    """Company overview / fundamentals snapshot."""

    target_keys = ["overview"]

    _KEEP = {
        "Symbol", "Name", "Description", "Sector", "Industry",
        "MarketCapitalization", "PERatio", "PEGRatio", "EPS",
        "RevenuePerShareTTM", "ProfitMargin", "OperatingMarginTTM",
        "ReturnOnEquityTTM", "RevenueTTM", "GrossProfitTTM",
        "DilutedEPSTTM", "QuarterlyEarningsGrowthYOY",
        "QuarterlyRevenueGrowthYOY", "AnalystTargetPrice",
        "52WeekHigh", "52WeekLow", "Beta",
        "ForwardPE", "PriceToBookRatio", "EVToRevenue", "EVToEBITDA",
    }

    def match_condition(self, data: dict) -> bool:
        return (
            "Symbol" in data and "Description" in data
            and "annualReports" not in data
            and "quarterlyEarnings" not in data
        )

    def strip(self, data: dict) -> dict:
        """Keep only the ~25 fields that drive fundamental analysis."""
        return {k: v for k, v in data.items() if k in self._KEEP}


class BalanceSheetStrategy(PayloadGoalStrategy):
    """Annual balance sheet reports."""

    target_keys = ["balance_sheet"]

    _KEEP = {
        "fiscalDateEnding", "totalAssets", "totalCurrentAssets",
        "totalLiabilities", "totalCurrentLiabilities",
        "totalShareholderEquity", "longTermDebt",
        "cashAndCashEquivalentsAtCarryingValue",
        "retainedEarnings", "commonStockSharesOutstanding",
    }

    def match_condition(self, data: dict) -> bool:
        reports = data.get("annualReports") or []
        return (
            bool(reports)
            and isinstance(reports, list)
            and isinstance(reports[0], dict)
            and "totalAssets" in reports[0]
        )

    def strip(self, data: dict, max_reports: int = 2) -> dict:
        reports = data.get("annualReports", [])[:max_reports]
        return {
            "symbol":        data.get("symbol"),
            "annualReports": [{k: v for k, v in r.items() if k in self._KEEP}
                              for r in reports],
        }


class IncomeStatementStrategy(PayloadGoalStrategy):
    """Annual income statement reports."""

    target_keys = ["income_statement"]

    _KEEP = {
        "fiscalDateEnding", "totalRevenue", "grossProfit",
        "operatingIncome", "netIncome", "ebitda",
        "researchAndDevelopment", "operatingExpenses",
        "incomeBeforeTax", "incomeTaxExpense", "eps", "epsDiluted",
    }

    def match_condition(self, data: dict) -> bool:
        reports = data.get("annualReports") or []
        return (
            bool(reports)
            and isinstance(reports, list)
            and isinstance(reports[0], dict)
            and "totalRevenue" in reports[0]
        )

    def strip(self, data: dict, max_reports: int = 2) -> dict:
        reports = data.get("annualReports", [])[:max_reports]
        return {
            "symbol":        data.get("symbol"),
            "annualReports": [{k: v for k, v in r.items() if k in self._KEEP}
                              for r in reports],
        }


class CashFlowStrategy(PayloadGoalStrategy):
    """Annual cash flow reports."""

    target_keys = ["cash_flow"]

    _KEEP = {
        "fiscalDateEnding", "operatingCashflow", "capitalExpenditures",
        "freeCashFlow", "cashflowFromInvestment", "cashflowFromFinancing",
        "dividendPayout", "netIncome",
    }

    def match_condition(self, data: dict) -> bool:
        reports = data.get("annualReports") or []
        return (
            bool(reports)
            and isinstance(reports, list)
            and isinstance(reports[0], dict)
            and "operatingCashflow" in reports[0]
        )

    def strip(self, data: dict, max_reports: int = 2) -> dict:
        reports = data.get("annualReports", [])[:max_reports]
        return {
            "symbol":        data.get("symbol"),
            "annualReports": [{k: v for k, v in r.items() if k in self._KEEP}
                              for r in reports],
        }


class EarningsStrategy(PayloadGoalStrategy):
    """Quarterly and annual earnings surprises."""

    target_keys = ["earnings"]

    _KEEP = {
        "fiscalDateEnding", "reportedDate", "reportedEPS",
        "estimatedEPS", "surprise", "surprisePercentage",
    }

    def match_condition(self, data: dict) -> bool:
        return "quarterlyEarnings" in data

    def strip(self, data: dict, max_quarters: int = 4) -> dict:
        quarters = data.get("quarterlyEarnings", [])[:max_quarters]
        return {
            "symbol":            data.get("symbol"),
            "annualEarnings":    data.get("annualEarnings", [])[:2],
            "quarterlyEarnings": [{k: v for k, v in q.items() if k in self._KEEP}
                                  for q in quarters],
        }


class InsiderTransactionsStrategy(PayloadGoalStrategy):
    """Recent insider buy/sell transactions."""

    target_keys = ["insider"]

    _KEEP = {
        "transaction_date", "ticker", "executive", "executive_title",
        "security_type", "transaction_type", "acquisition_or_disposal",
        "shares", "share_price",
    }

    def match_condition(self, data: dict) -> bool:
        transactions = data.get("data") or []
        return (
            bool(transactions)
            and isinstance(transactions, list)
            and isinstance(transactions[0], dict)
            and "transaction_date" in transactions[0]
        )

    def strip(self, data: dict, max_transactions: int = 15) -> dict:
        transactions = data.get("data", [])[:max_transactions]
        return {
            "data": [{k: v for k, v in t.items() if k in self._KEEP}
                     for t in transactions],
        }


# ================================================================== #
# 3. Engine                                                            #
# ================================================================== #

class UniversalPayloadStripper:
    """
    Vendor-agnostic stripping engine.

    Accepts any list of PayloadGoalStrategy instances and routes raw
    JSON payloads through them.  The engine itself has no knowledge of
    Alpha Vantage, SEC Edgar, or any other data provider.

    Routing order:
      1. Content-based:  iterate strategies, call match_condition().
      2. Name-based:     iterate strategies, match tool_name substrings.
      3. Passthrough:    return raw_text unchanged if no strategy matches.
    """

    def __init__(self, strategies: list[PayloadGoalStrategy]):
        self.strategies = strategies

    def process(self, context_name: str, raw_text: str) -> str:
        """Strip raw_text using the registered strategies. Returns a JSON string."""
        try:
            data = json.loads(raw_text)
        except (json.JSONDecodeError, TypeError):
            return raw_text

        if not isinstance(data, dict):
            return raw_text

        for strategy in self.strategies:
            if strategy.match_condition(data):
                return json.dumps(strategy.strip(data), default=str)

        name_lower = context_name.lower()
        for strategy in self.strategies:
            if any(k in name_lower for k in strategy.target_keys):
                return json.dumps(strategy.strip(data), default=str)

        return raw_text


# ================================================================== #
# 4. Alpha Vantage Facade (backwards-compatible)                       #
# ================================================================== #

_AV_STRIPPER = UniversalPayloadStripper([
    TimeSeriesStrategy(),
    NewsStrategy(),
    OverviewStrategy(),
    BalanceSheetStrategy(),
    IncomeStatementStrategy(),
    CashFlowStrategy(),
    EarningsStrategy(),
    InsiderTransactionsStrategy(),
])


class AlphaVantagePayloadStripper:
    """
    Drop-in replacement for the original monolithic stripper.

    client.py calls AlphaVantagePayloadStripper.strip(tool_name, raw_text)
    exactly as before — this facade simply delegates to the engine.
    """

    @staticmethod
    def strip(tool_name: str, raw_text: str) -> str:
        return _AV_STRIPPER.process(tool_name, raw_text)
