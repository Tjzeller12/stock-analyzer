"""
test_payload_stripper.py — unit tests for AlphaVantagePayloadStripper.

These tests are pure unit tests: no Flask app context, no database,
no API keys. They verify that each stripper method correctly reduces
a realistic Alpha Vantage response to only the fields Claude needs.
"""
import json
import pytest
from app.services.payload_stripper import AlphaVantagePayloadStripper


# ------------------------------------------------------------------ #
# Realistic fixture payloads (mirrors actual Alpha Vantage responses)  #
# ------------------------------------------------------------------ #

def make_time_series_daily(num_days=100):
    """Build a TIME_SERIES_DAILY-style response with num_days of OHLCV rows."""
    series = {}
    for i in range(num_days):
        date = f"2024-{str((i // 30) + 1).zfill(2)}-{str((i % 28) + 1).zfill(2)}"
        series[date] = {
            "1. open":   f"{150 + i}.00",
            "2. high":   f"{152 + i}.00",
            "3. low":    f"{148 + i}.00",
            "4. close":  f"{151 + i}.00",
            "5. volume": f"{1000000 + i * 1000}",
        }
    return {
        "Meta Data": {
            "1. Information": "Daily Prices",
            "2. Symbol": "AAPL",
            "3. Last Refreshed": "2024-01-15",
            "4. Output Size": "Compact",
            "5. Time Zone": "US/Eastern",
        },
        "Time Series (Daily)": series,
    }


def make_news_response(num_articles=20):
    """Build a NEWS_SENTIMENT-style response with num_articles."""
    feed = []
    for i in range(num_articles):
        feed.append({
            "title":  f"Article {i}: Some headline about stock movement",
            "url":    f"https://example.com/article-{i}",
            "time_published": f"20240115T{str(i).zfill(2)}0000",
            "authors": ["Author Name"],
            "summary": "X" * 400,  # 400-char summary — should be truncated
            "banner_image": "https://example.com/banner.jpg",
            "source": "Bloomberg",
            "category_within_source": "n/a",
            "source_domain": "bloomberg.com",
            "topics": [{"topic": "Finance", "relevance_score": "0.9"}],
            "overall_sentiment_score": 0.25,
            "overall_sentiment_label": "Somewhat-Bullish",
            "ticker_sentiment": [
                {"ticker": "AAPL", "relevance_score": "0.9",
                 "ticker_sentiment_label": "Bullish", "ticker_sentiment_score": "0.4"},
                {"ticker": "MSFT", "relevance_score": "0.3",
                 "ticker_sentiment_label": "Neutral", "ticker_sentiment_score": "0.1"},
                {"ticker": "TSLA", "relevance_score": "0.2",
                 "ticker_sentiment_label": "Bearish", "ticker_sentiment_score": "-0.2"},
                {"ticker": "NVDA", "relevance_score": "0.1",
                 "ticker_sentiment_label": "Neutral", "ticker_sentiment_score": "0.05"},
                {"ticker": "AMZN", "relevance_score": "0.05",
                 "ticker_sentiment_label": "Neutral", "ticker_sentiment_score": "0.0"},
            ],
        })
    return {
        "items": str(num_articles),
        "sentiment_score_definition": "x <= -0.35 for Bearish ...",
        "relevance_score_definition": "0 < x <= 1, ...",
        "feed": feed,
    }


def make_overview_response():
    """Build a COMPANY_OVERVIEW-style response with all ~60 Alpha Vantage fields."""
    return {
        "Symbol": "AAPL",
        "AssetType": "Common Stock",
        "Name": "Apple Inc",
        "Description": "Apple Inc. designs, manufactures, and markets smartphones...",
        "CIK": "320193",
        "Exchange": "NASDAQ",
        "Currency": "USD",
        "Country": "USA",
        "Sector": "TECHNOLOGY",
        "Industry": "ELECTRONIC COMPUTERS",
        "Address": "One Apple Park Way, Cupertino, CA, US",
        "OfficialSite": "https://www.apple.com",
        "FiscalYearEnd": "September",
        "LatestQuarter": "2023-12-30",
        "MarketCapitalization": "2850000000000",
        "EBITDA": "123000000000",
        "PERatio": "29.5",
        "PEGRatio": "2.1",
        "BookValue": "4.83",
        "DividendPerShare": "0.97",
        "DividendYield": "0.0054",
        "EPS": "6.42",
        "RevenuePerShareTTM": "24.78",
        "ProfitMargin": "0.258",
        "OperatingMarginTTM": "0.298",
        "ReturnOnAssetsTTM": "0.286",
        "ReturnOnEquityTTM": "1.45",
        "RevenueTTM": "385600000000",
        "GrossProfitTTM": "169150000000",
        "DilutedEPSTTM": "6.42",
        "QuarterlyEarningsGrowthYOY": "0.161",
        "QuarterlyRevenueGrowthYOY": "0.029",
        "AnalystTargetPrice": "210.00",
        "AnalystRatingStrongBuy": "12",
        "AnalystRatingBuy": "20",
        "AnalystRatingHold": "8",
        "AnalystRatingSell": "2",
        "AnalystRatingStrongSell": "0",
        "TrailingPE": "29.5",
        "ForwardPE": "27.3",
        "PriceToSalesRatioTTM": "7.38",
        "PriceToBookRatio": "45.1",
        "EVToRevenue": "7.5",
        "EVToEBITDA": "23.1",
        "Beta": "1.26",
        "52WeekHigh": "199.62",
        "52WeekLow": "124.17",
        "50DayMovingAverage": "188.5",
        "200DayMovingAverage": "178.2",
        "SharesOutstanding": "15550000000",
        "DividendDate": "2024-02-15",
        "ExDividendDate": "2024-02-09",
    }


def make_balance_sheet_response(num_reports=4):
    reports = []
    for i in range(num_reports):
        year = 2023 - i
        reports.append({
            "fiscalDateEnding":                    f"{year}-09-30",
            "reportedCurrency":                    "USD",
            "totalAssets":                         str(335000000000 - i * 5000000000),
            "totalCurrentAssets":                  str(143000000000 - i * 2000000000),
            "cashAndCashEquivalentsAtCarryingValue": str(29965000000 - i * 1000000000),
            "cashAndShortTermInvestments":         str(61555000000 - i * 2000000000),
            "inventory":                           str(6331000000 - i * 100000000),
            "currentNetReceivables":               str(60985000000 - i * 500000000),
            "totalNonCurrentAssets":               str(209000000000 - i * 3000000000),
            "propertyPlantEquipment":              str(43715000000 - i * 1000000000),
            "accumulatedDepreciationAmortizationPPE": str(-72340000000 + i * 500000000),
            "intangibleAssets":                    "0",
            "intangibleAssetsExcludingGoodwill":   "0",
            "goodwill":                            "0",
            "investments":                         str(100544000000 - i * 2000000000),
            "longTermInvestments":                 str(100544000000 - i * 2000000000),
            "shortTermInvestments":                str(31590000000 - i * 500000000),
            "otherCurrentAssets":                  str(14695000000 - i * 200000000),
            "otherNonCurrentAssets":               str(64758000000 - i * 1000000000),
            "totalLiabilities":                    str(290437000000 - i * 4000000000),
            "totalCurrentLiabilities":             str(145308000000 - i * 3000000000),
            "currentAccountsPayable":              str(62611000000 - i * 1000000000),
            "deferredRevenue":                     str(8061000000 - i * 100000000),
            "currentDebt":                         str(9822000000 - i * 200000000),
            "shortTermDebt":                       str(9822000000 - i * 200000000),
            "totalNonCurrentLiabilities":          str(145129000000 - i * 1000000000),
            "capitalLeaseObligations":             str(10660000000 - i * 200000000),
            "longTermDebt":                        str(95281000000 - i * 2000000000),
            "currentLongTermDebt":                 str(9822000000 - i * 200000000),
            "longTermDebtNoncurrent":              str(95281000000 - i * 2000000000),
            "shortLongTermDebtTotal":              str(105103000000 - i * 2000000000),
            "otherCurrentLiabilities":             str(58829000000 - i * 1000000000),
            "otherNonCurrentLiabilities":          str(49848000000 - i * 500000000),
            "totalShareholderEquity":              str(62146000000 - i * 1000000000),
            "treasuryStock":                       str(-702379000000 + i * 10000000000),
            "retainedEarnings":                    str(-214000000000 + i * 5000000000),
            "commonStock":                         str(73812000000 - i * 1000000000),
            "commonStockSharesOutstanding":        str(15552000000 - i * 200000000),
        })
    return {"symbol": "AAPL", "annualReports": reports, "quarterlyReports": []}


def make_earnings_response(num_quarters=8):
    quarters = []
    for i in range(num_quarters):
        quarters.append({
            "fiscalDateEnding":   f"2024-{str(12 - i * 3).zfill(2)}-30",
            "reportedDate":       f"2024-{str(12 - i * 3).zfill(2)}-15",
            "reportedEPS":        str(round(2.15 - i * 0.05, 2)),
            "estimatedEPS":       str(round(2.10 - i * 0.05, 2)),
            "surprise":           str(round(0.05 + i * 0.01, 2)),
            "surprisePercentage": str(round(2.5 + i * 0.3, 2)),
        })
    return {
        "symbol": "AAPL",
        "annualEarnings": [
            {"fiscalDateEnding": "2023-09-30", "reportedEPS": "6.42"},
            {"fiscalDateEnding": "2022-09-30", "reportedEPS": "6.11"},
            {"fiscalDateEnding": "2021-09-30", "reportedEPS": "5.67"},
        ],
        "quarterlyEarnings": quarters,
    }


# ------------------------------------------------------------------ #
# Tests: time series                                                    #
# ------------------------------------------------------------------ #

class TestStripTimeSeries:

    def test_caps_at_30_entries(self):
        raw = json.dumps(make_time_series_daily(num_days=100))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "TIME_SERIES_DAILY", raw
        ))
        series = result["Time Series (Daily)"]
        assert len(series) <= 30

    def test_keeps_close_and_volume(self):
        raw = json.dumps(make_time_series_daily(num_days=5))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "TIME_SERIES_DAILY", raw
        ))
        first_row = next(iter(result["Time Series (Daily)"].values()))
        assert "close"  in first_row
        assert "volume" in first_row

    def test_removes_open_high_low(self):
        raw = json.dumps(make_time_series_daily(num_days=5))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "TIME_SERIES_DAILY", raw
        ))
        first_row = next(iter(result["Time Series (Daily)"].values()))
        for removed in ("open", "1. open", "high", "2. high", "low", "3. low"):
            assert removed not in first_row

    def test_meta_data_preserved(self):
        raw = json.dumps(make_time_series_daily(num_days=5))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "TIME_SERIES_DAILY", raw
        ))
        assert "Meta Data" in result

    def test_routes_on_weekly_tool_name(self):
        payload = {
            "Meta Data": {"2. Symbol": "AAPL"},
            "Weekly Time Series": {
                f"2024-01-{str(i+1).zfill(2)}": {
                    "1. open": "150", "2. high": "155",
                    "3. low": "148", "4. close": "153", "5. volume": "5000000",
                }
                for i in range(10)
            },
        }
        raw = json.dumps(payload)
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "TIME_SERIES_WEEKLY", raw
        ))
        series = result["Weekly Time Series"]
        first_row = next(iter(series.values()))
        assert "close"  in first_row
        assert "volume" in first_row
        assert "high"   not in first_row

    def test_routes_on_intraday_tool_name(self):
        payload = {
            "Meta Data": {"2. Symbol": "AAPL"},
            "Time Series (5min)": {
                f"2024-01-15 {str(i+9).zfill(2)}:00:00": {
                    "1. open": "185", "2. high": "186",
                    "3. low": "184", "4. close": "185.5", "5. volume": "100000",
                }
                for i in range(5)
            },
        }
        raw = json.dumps(payload)
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "TIME_SERIES_INTRADAY", raw
        ))
        series = result["Time Series (5min)"]
        first_row = next(iter(series.values()))
        assert "close" in first_row


# ------------------------------------------------------------------ #
# Tests: news                                                           #
# ------------------------------------------------------------------ #

class TestStripNews:

    def test_caps_at_5_articles(self):
        raw = json.dumps(make_news_response(num_articles=20))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "NEWS_SENTIMENT", raw
        ))
        assert len(result["feed"]) == 5

    def test_fewer_articles_than_cap_kept_intact(self):
        raw = json.dumps(make_news_response(num_articles=3))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "NEWS_SENTIMENT", raw
        ))
        assert len(result["feed"]) == 3

    def test_summary_truncated_to_120_chars(self):
        raw = json.dumps(make_news_response(num_articles=2))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "NEWS_SENTIMENT", raw
        ))
        for article in result["feed"]:
            assert len(article["summary"]) <= 120

    def test_keeps_required_fields(self):
        raw = json.dumps(make_news_response(num_articles=1))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "NEWS_SENTIMENT", raw
        ))
        article = result["feed"][0]
        for field in ("title", "time_published", "summary", "source",
                      "overall_sentiment_label", "overall_sentiment_score",
                      "ticker_sentiment"):
            assert field in article, f"Missing field: {field}"

    def test_removes_noisy_fields(self):
        raw = json.dumps(make_news_response(num_articles=1))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "NEWS_SENTIMENT", raw
        ))
        article = result["feed"][0]
        for noisy in ("url", "authors", "banner_image",
                      "category_within_source", "source_domain", "topics"):
            assert noisy not in article, f"Noisy field still present: {noisy}"

    def test_ticker_sentiment_capped_at_4(self):
        raw = json.dumps(make_news_response(num_articles=1))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "NEWS_SENTIMENT", raw
        ))
        assert len(result["feed"][0]["ticker_sentiment"]) <= 4

    def test_metadata_fields_preserved(self):
        raw = json.dumps(make_news_response(num_articles=5))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "NEWS_SENTIMENT", raw
        ))
        assert "items" in result
        assert "sentiment_score_definition" in result


# ------------------------------------------------------------------ #
# Tests: overview                                                       #
# ------------------------------------------------------------------ #

class TestStripOverview:

    def test_keeps_core_fundamental_fields(self):
        raw = json.dumps(make_overview_response())
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "COMPANY_OVERVIEW", raw
        ))
        for field in ("Symbol", "Name", "Sector", "Industry",
                      "MarketCapitalization", "PERatio", "EPS",
                      "ProfitMargin", "Beta", "52WeekHigh", "52WeekLow"):
            assert field in result, f"Missing field: {field}"

    def test_removes_boilerplate_fields(self):
        raw = json.dumps(make_overview_response())
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "COMPANY_OVERVIEW", raw
        ))
        for boilerplate in ("AssetType", "CIK", "Exchange", "Currency",
                             "Country", "Address", "OfficialSite",
                             "FiscalYearEnd", "LatestQuarter",
                             "50DayMovingAverage", "200DayMovingAverage",
                             "SharesOutstanding", "DividendDate",
                             "ExDividendDate", "AnalystRatingBuy",
                             "TrailingPE", "PriceToSalesRatioTTM"):
            assert boilerplate not in result, f"Boilerplate field still present: {boilerplate}"

    def test_significantly_reduces_field_count(self):
        original = make_overview_response()
        raw = json.dumps(original)
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "COMPANY_OVERVIEW", raw
        ))
        assert len(result) < len(original)
        # Should be roughly half the original or fewer
        assert len(result) <= len(original) // 2


# ------------------------------------------------------------------ #
# Tests: balance sheet                                                  #
# ------------------------------------------------------------------ #

class TestStripBalanceSheet:

    def test_caps_at_2_annual_reports(self):
        raw = json.dumps(make_balance_sheet_response(num_reports=4))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "BALANCE_SHEET", raw
        ))
        assert len(result["annualReports"]) == 2

    def test_keeps_key_line_items(self):
        raw = json.dumps(make_balance_sheet_response(num_reports=1))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "BALANCE_SHEET", raw
        ))
        report = result["annualReports"][0]
        for field in ("fiscalDateEnding", "totalAssets", "totalLiabilities",
                      "totalShareholderEquity", "longTermDebt",
                      "cashAndCashEquivalentsAtCarryingValue"):
            assert field in report, f"Missing field: {field}"

    def test_removes_granular_fields(self):
        raw = json.dumps(make_balance_sheet_response(num_reports=1))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "BALANCE_SHEET", raw
        ))
        report = result["annualReports"][0]
        for noisy in ("reportedCurrency", "accumulatedDepreciationAmortizationPPE",
                      "intangibleAssets", "goodwill", "otherNonCurrentAssets",
                      "capitalLeaseObligations"):
            assert noisy not in report, f"Noisy field still present: {noisy}"


# ------------------------------------------------------------------ #
# Tests: earnings                                                       #
# ------------------------------------------------------------------ #

class TestStripEarnings:

    def test_caps_quarterly_at_4(self):
        raw = json.dumps(make_earnings_response(num_quarters=8))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "EARNINGS", raw
        ))
        assert len(result["quarterlyEarnings"]) == 4

    def test_caps_annual_earnings_at_2(self):
        raw = json.dumps(make_earnings_response())
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "EARNINGS", raw
        ))
        assert len(result["annualEarnings"]) == 2

    def test_keeps_surprise_fields(self):
        raw = json.dumps(make_earnings_response(num_quarters=1))
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "EARNINGS", raw
        ))
        q = result["quarterlyEarnings"][0]
        for field in ("reportedEPS", "estimatedEPS", "surprise",
                      "surprisePercentage", "fiscalDateEnding"):
            assert field in q, f"Missing field: {field}"


# ------------------------------------------------------------------ #
# Tests: fallback / edge cases                                          #
# ------------------------------------------------------------------ #

class TestContentBasedRouting:
    """
    Verify that strip() correctly routes by JSON structure when the tool name
    is a generic MCP name like TOOL_CALL (as used by the Alpha Vantage MCP).
    """

    def test_detects_time_series_by_content(self):
        raw = json.dumps(make_time_series_daily(5))
        result = json.loads(AlphaVantagePayloadStripper.strip("TOOL_CALL", raw))
        series = result["Time Series (Daily)"]
        first = next(iter(series.values()))
        assert "close" in first
        assert "open" not in first

    def test_detects_news_by_content(self):
        raw = json.dumps(make_news_response(10))
        result = json.loads(AlphaVantagePayloadStripper.strip("TOOL_CALL", raw))
        assert len(result["feed"]) <= 5

    def test_detects_overview_by_content(self):
        raw = json.dumps(make_overview_response())
        result = json.loads(AlphaVantagePayloadStripper.strip("TOOL_GET", raw))
        assert "Symbol" in result
        assert "Address" not in result

    def test_detects_balance_sheet_by_content(self):
        raw = json.dumps(make_balance_sheet_response(4))
        result = json.loads(AlphaVantagePayloadStripper.strip("TOOL_CALL", raw))
        assert len(result["annualReports"]) == 2

    def test_detects_earnings_by_content(self):
        raw = json.dumps(make_earnings_response(8))
        result = json.loads(AlphaVantagePayloadStripper.strip("TOOL_CALL", raw))
        assert len(result["quarterlyEarnings"]) == 4

    def test_unknown_content_with_generic_name_returns_original(self):
        raw = json.dumps({"some_unknown_key": "value", "another": 123})
        result = AlphaVantagePayloadStripper.strip("TOOL_CALL", raw)
        assert result == raw


class TestFallbackAndEdgeCases:

    def test_unknown_tool_name_returns_original_text(self):
        raw = json.dumps({"foo": "bar", "baz": [1, 2, 3]})
        result = AlphaVantagePayloadStripper.strip("UNKNOWN_TOOL_XYZ", raw)
        assert result == raw

    def test_non_json_text_returned_as_is(self):
        raw = "This is plain text, not JSON at all."
        result = AlphaVantagePayloadStripper.strip("TIME_SERIES_DAILY", raw)
        assert result == raw

    def test_empty_string_returned_as_is(self):
        result = AlphaVantagePayloadStripper.strip("TIME_SERIES_DAILY", "")
        assert result == ""

    def test_none_returned_as_is(self):
        result = AlphaVantagePayloadStripper.strip("TIME_SERIES_DAILY", None)
        assert result is None

    def test_empty_time_series_does_not_crash(self):
        raw = json.dumps({
            "Meta Data": {"2. Symbol": "AAPL"},
            "Time Series (Daily)": {},
        })
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "TIME_SERIES_DAILY", raw
        ))
        assert result["Time Series (Daily)"] == {}

    def test_empty_news_feed_does_not_crash(self):
        raw = json.dumps({"items": "0", "feed": []})
        result = json.loads(AlphaVantagePayloadStripper.strip(
            "NEWS_SENTIMENT", raw
        ))
        assert result["feed"] == []

    def test_output_is_valid_json(self):
        """The stripped output must always be parseable JSON."""
        payloads = [
            ("TIME_SERIES_DAILY",  json.dumps(make_time_series_daily(5))),
            ("NEWS_SENTIMENT",     json.dumps(make_news_response(5))),
            ("COMPANY_OVERVIEW",   json.dumps(make_overview_response())),
            ("BALANCE_SHEET",      json.dumps(make_balance_sheet_response(2))),
            ("EARNINGS",           json.dumps(make_earnings_response(4))),
        ]
        for tool_name, raw in payloads:
            result = AlphaVantagePayloadStripper.strip(tool_name, raw)
            try:
                json.loads(result)
            except json.JSONDecodeError as e:
                pytest.fail(f"{tool_name} produced invalid JSON: {e}")

    def test_stripping_reduces_payload_size(self):
        """Stripped output must always be smaller than the original."""
        cases = [
            ("TIME_SERIES_DAILY", json.dumps(make_time_series_daily(100))),
            ("NEWS_SENTIMENT",    json.dumps(make_news_response(20))),
            ("COMPANY_OVERVIEW",  json.dumps(make_overview_response())),
            ("BALANCE_SHEET",     json.dumps(make_balance_sheet_response(4))),
            ("EARNINGS",          json.dumps(make_earnings_response(8))),
        ]
        for tool_name, raw in cases:
            stripped = AlphaVantagePayloadStripper.strip(tool_name, raw)
            assert len(stripped) < len(raw), (
                f"{tool_name}: stripped ({len(stripped)}) is not smaller "
                f"than original ({len(raw)})"
            )

    def test_tool_name_case_insensitive_routing(self):
        """Routing must work regardless of uppercase/lowercase in tool name."""
        raw = json.dumps(make_time_series_daily(5))
        result_upper = AlphaVantagePayloadStripper.strip("TIME_SERIES_DAILY", raw)
        result_lower = AlphaVantagePayloadStripper.strip("time_series_daily", raw)
        assert result_upper == result_lower
