"""
AlphaVantagePayloadStripper
----------------------------
Intercepts raw Alpha Vantage MCP tool responses and strips them down to only
the fields and rows that Claude actually needs for analysis. This prevents
token-limit errors and reduces cost without losing analytical signal.

Usage (in _execute_tool_calls):
    from app.services.payload_stripper import AlphaVantagePayloadStripper
    tool_output = AlphaVantagePayloadStripper.strip(item.name, tool_output)

Adding a new strip profile:
    1. Add a _strip_<name> classmethod below.
    2. Add a routing rule in the `strip` method's if/elif chain.
"""
import json


class AlphaVantagePayloadStripper:

    # ------------------------------------------------------------------ #
    # Public entry point                                                   #
    # ------------------------------------------------------------------ #

    @classmethod
    def strip(cls, tool_name: str, raw_text: str) -> str:
        """
        Route the raw MCP tool response to the correct stripper and return
        a compact JSON string.

        Routing priority:
        1. Content-based: inspect the JSON structure to detect the data type.
           This handles generic MCP tool names like TOOL_CALL / TOOL_GET where
           the meaningful AV function name is not exposed in the tool name.
        2. Name-based fallback: for well-named tools that content detection
           might miss (e.g. an all-empty overview).

        Falls back to the original text if the payload is not JSON or if
        neither routing path finds a match.
        """
        try:
            data = json.loads(raw_text)
        except (json.JSONDecodeError, TypeError):
            return raw_text

        # 1. Content-based routing (works regardless of tool name)
        stripped = cls._strip_by_content(data)
        if stripped is not None:
            return json.dumps(stripped, default=str)

        # 2. Name-based fallback for well-named tools
        name = tool_name.lower()

        if any(k in name for k in ("time_series_daily", "time_series_weekly",
                                    "time_series_monthly", "intraday")):
            stripped = cls._strip_time_series(data)

        elif "news" in name:
            stripped = cls._strip_news(data)

        elif "overview" in name:
            stripped = cls._strip_overview(data)

        elif "balance_sheet" in name:
            stripped = cls._strip_balance_sheet(data)

        elif "income_statement" in name:
            stripped = cls._strip_income_statement(data)

        elif "cash_flow" in name:
            stripped = cls._strip_cash_flow(data)

        elif "earnings" in name:
            stripped = cls._strip_earnings(data)

        elif "insider" in name:
            stripped = cls._strip_insider_transactions(data)

        else:
            return raw_text

        return json.dumps(stripped, default=str)

    @classmethod
    def _strip_by_content(cls, data: dict):
        """
        Detect the Alpha Vantage data type by inspecting the JSON structure
        rather than the tool name. Returns the stripped dict, or None if the
        structure is not recognised.
        """
        if not isinstance(data, dict):
            return None

        # Time series: any key whose name contains "time series" or known
        # interval keywords, and whose value is a dict-of-dicts (OHLCV rows).
        for key in data:
            key_lower = key.lower()
            if any(k in key_lower for k in ("time series", "weekly", "monthly", "intraday")):
                if isinstance(data[key], dict):
                    return cls._strip_time_series(data)

        # News sentiment: top-level "feed" list
        if "feed" in data and isinstance(data.get("feed"), list):
            return cls._strip_news(data)

        # Company overview: has Symbol + Description but no nested reports
        if ("Symbol" in data and "Description" in data
                and "annualReports" not in data and "quarterlyEarnings" not in data):
            return cls._strip_overview(data)

        # Earnings: has quarterlyEarnings list
        if "quarterlyEarnings" in data:
            return cls._strip_earnings(data)

        # Balance sheet / income statement / cash flow: all use annualReports
        reports = data.get("annualReports") or []
        if reports and isinstance(reports, list) and isinstance(reports[0], dict):
            first = reports[0]
            if "totalAssets" in first:
                return cls._strip_balance_sheet(data)
            if "totalRevenue" in first:
                return cls._strip_income_statement(data)
            if "operatingCashflow" in first:
                return cls._strip_cash_flow(data)

        # Insider transactions: top-level "data" list with transaction_date
        transactions = data.get("data") or []
        if (transactions and isinstance(transactions, list)
                and isinstance(transactions[0], dict)
                and "transaction_date" in transactions[0]):
            return cls._strip_insider_transactions(data)

        return None

    # ------------------------------------------------------------------ #
    # Per-type strip profiles                                              #
    # ------------------------------------------------------------------ #

    @classmethod
    def _strip_time_series(cls, data: dict, max_entries: int = 30) -> dict:
        """
        Keep only the N most-recent trading days and reduce each OHLCV row
        to close and volume. High/low/open add noise for swing classification
        and this keeps each tool result small across multi-tool ReAct loops.
        """
        result = {}
        for key, value in data.items():
            # Only process keys that look like time series data (dict of dicts).
            # Meta Data is also a dict but its values are plain strings, so we
            # check that the first child value is itself a dict before stripping.
            if isinstance(value, dict) and value and isinstance(next(iter(value.values())), dict):
                recent = dict(list(value.items())[:max_entries])
                result[key] = {
                    date: {
                        "close":  row.get("4. close")  or row.get("5. adjusted close", ""),
                        "volume": row.get("5. volume") or row.get("6. volume", ""),
                    }
                    for date, row in recent.items()
                }
            else:
                result[key] = value
        return result

    @classmethod
    def _strip_news(cls, data: dict, max_articles: int = 5,
                    summary_chars: int = 120) -> dict:
        """
        Limit to N articles and keep only the fields that matter for
        event correlation: title, publish time, a truncated summary,
        and sentiment scores.
        """
        articles = data.get("feed", [])[:max_articles]
        return {
            "items":      data.get("items"),
            "sentiment_score_definition": data.get("sentiment_score_definition"),
            "relevance_score_definition": data.get("relevance_score_definition"),
            "feed": [
                {
                    "title":                    a.get("title"),
                    "time_published":           a.get("time_published"),
                    "summary":                  (a.get("summary") or "")[:summary_chars],
                    "source":                   a.get("source"),
                    "overall_sentiment_label":  a.get("overall_sentiment_label"),
                    "overall_sentiment_score":  a.get("overall_sentiment_score"),
                    "ticker_sentiment": [
                        {
                            "ticker":                   ts.get("ticker"),
                            "relevance_score":          ts.get("relevance_score"),
                            "ticker_sentiment_label":   ts.get("ticker_sentiment_label"),
                            "ticker_sentiment_score":   ts.get("ticker_sentiment_score"),
                        }
                        for ts in a.get("ticker_sentiment", [])[:4]
                    ],
                }
                for a in articles
            ],
        }

    @classmethod
    def _strip_overview(cls, data: dict) -> dict:
        """
        Keep only the ~25 fields that drive fundamental analysis.
        Drops hundreds of redundant or rarely-used metrics.
        """
        KEEP = {
            "Symbol", "Name", "Description", "Sector", "Industry",
            "MarketCapitalization", "PERatio", "PEGRatio", "EPS",
            "RevenuePerShareTTM", "ProfitMargin", "OperatingMarginTTM",
            "ReturnOnEquityTTM", "RevenueTTM", "GrossProfitTTM",
            "DilutedEPSTTM", "QuarterlyEarningsGrowthYOY",
            "QuarterlyRevenueGrowthYOY", "AnalystTargetPrice",
            "52WeekHigh", "52WeekLow", "Beta",
            "ForwardPE", "PriceToBookRatio", "EVToRevenue", "EVToEBITDA",
        }
        return {k: v for k, v in data.items() if k in KEEP}

    @classmethod
    def _strip_balance_sheet(cls, data: dict, max_reports: int = 2) -> dict:
        """Keep the two most-recent annual reports, strip to key line items."""
        KEEP = {
            "fiscalDateEnding", "totalAssets", "totalCurrentAssets",
            "totalLiabilities", "totalCurrentLiabilities",
            "totalShareholderEquity", "longTermDebt", "cashAndCashEquivalentsAtCarryingValue",
            "retainedEarnings", "commonStockSharesOutstanding",
        }
        reports = data.get("annualReports", [])[:max_reports]
        return {
            "symbol":         data.get("symbol"),
            "annualReports":  [{k: v for k, v in r.items() if k in KEEP} for r in reports],
        }

    @classmethod
    def _strip_income_statement(cls, data: dict, max_reports: int = 2) -> dict:
        """Keep the two most-recent annual reports, strip to key line items."""
        KEEP = {
            "fiscalDateEnding", "totalRevenue", "grossProfit",
            "operatingIncome", "netIncome", "ebitda",
            "researchAndDevelopment", "operatingExpenses",
            "incomeBeforeTax", "incomeTaxExpense", "eps", "epsDiluted",
        }
        reports = data.get("annualReports", [])[:max_reports]
        return {
            "symbol":        data.get("symbol"),
            "annualReports": [{k: v for k, v in r.items() if k in KEEP} for r in reports],
        }

    @classmethod
    def _strip_cash_flow(cls, data: dict, max_reports: int = 2) -> dict:
        """Keep the two most-recent annual reports, strip to key line items."""
        KEEP = {
            "fiscalDateEnding", "operatingCashflow", "capitalExpenditures",
            "freeCashFlow", "cashflowFromInvestment", "cashflowFromFinancing",
            "dividendPayout", "netIncome",
        }
        reports = data.get("annualReports", [])[:max_reports]
        return {
            "symbol":        data.get("symbol"),
            "annualReports": [{k: v for k, v in r.items() if k in KEEP} for r in reports],
        }

    @classmethod
    def _strip_earnings(cls, data: dict, max_quarters: int = 4) -> dict:
        """Keep the four most-recent quarterly earnings reports."""
        KEEP = {
            "fiscalDateEnding", "reportedDate", "reportedEPS",
            "estimatedEPS", "surprise", "surprisePercentage",
        }
        quarters = data.get("quarterlyEarnings", [])[:max_quarters]
        return {
            "symbol":            data.get("symbol"),
            "annualEarnings":    data.get("annualEarnings", [])[:2],
            "quarterlyEarnings": [{k: v for k, v in q.items() if k in KEEP} for q in quarters],
        }

    @classmethod
    def _strip_insider_transactions(cls, data: dict, max_transactions: int = 15) -> dict:
        """Keep the N most-recent insider transactions, drop boilerplate fields."""
        KEEP = {
            "transaction_date", "ticker", "executive", "executive_title",
            "security_type", "transaction_type", "acquisition_or_disposal",
            "shares", "share_price",
        }
        transactions = data.get("data", [])[:max_transactions]
        return {
            "data": [{k: v for k, v in t.items() if k in KEEP} for t in transactions],
        }
