"""
test_ingest_parsing.py — ingest stores what the provider sent, and nothing it didn't.

Covers planning/14-radar-scoring-refinement/phase-1-design.md PR 1:
P2 (placeholders are stored as None, never 0.0) and P11 (no new provider calls).
Alpha Vantage, FMP, and the AI analyses are mocked; nothing leaves the process.
"""
import datetime
from unittest.mock import MagicMock, patch

import pytest

from app import db
from app.alphaBot.analysis import AI_FALLBACK_SUMMARY, MoatAnalysis, NewsAnalysis
from app.constants import AlphaVantageFunction as AV
from app.models import StockMaster
from app.services.alpha_api import get_in_depth_financials, parse_provider_number
from app.services.stock_manager import (
    add_to_master,
    calculate_balance_sheet_metrics,
    calculate_cash_flow_metrics,
    get_ai_analysis_metrics,
)

RATE_LIMITED = {"Information": "API rate limit reached."}
TEST_SYMBOLS = ["TLOSS", "TPROF", "TNEW", "TRATE", "TCALL", "TFMP", "TAIF"]


@pytest.fixture(autouse=True)
def remove_test_rows(app):
    yield
    with app.app_context():
        StockMaster.query.filter(StockMaster.symbol.in_(TEST_SYMBOLS)).delete(synchronize_session=False)
        db.session.commit()


def _overview(**overrides):
    """An OVERVIEW payload for a profitable company. Pass `Key=...` to drop a key."""
    payload = {
        "Symbol": "TPROF",
        "AssetType": "Common Stock",
        "Name": "Test Profitable Co",
        "Sector": "TECHNOLOGY",
        "Industry": "SOFTWARE - INFRASTRUCTURE",
        "Description": "Makes software.",
        "MarketCapitalization": "50000000000",
        "EBITDA": "4000000000",
        "PERatio": "25.4",
        "PEGRatio": "1.8",
        "DividendYield": "0.012",
        "DilutedEPSTTM": "3.10",
        "ProfitMargin": "0.21",
        "OperatingMarginTTM": "0.27",
        "ReturnOnAssetsTTM": "0.11",
        "ReturnOnEquityTTM": "0.32",
        "QuarterlyEarningsGrowthYOY": "0.15",
        "QuarterlyRevenueGrowthYOY": "0.09",
        "AnalystRatingStrongBuy": "4",
        "AnalystRatingBuy": "10",
        "AnalystRatingHold": "6",
        "AnalystRatingSell": "1",
        "AnalystRatingStrongSell": "0",
        "ForwardPE": "22.0",
        "PriceToSalesRatioTTM": "6.1",
        "PriceToBookRatio": "8.2",
        "EVToEBITDA": "18.3",
        "Beta": "1.10",
    }
    payload.update(overrides)
    return {k: v for k, v in payload.items() if v is not ...}


def _cash_flow(ocf="5000000000", capex="1200000000"):
    return {"symbol": "X", "annualReports": [{
        "fiscalDateEnding": "2025-12-31", "reportedCurrency": "USD",
        "operatingCashflow": ocf, "capitalExpenditures": capex,
    }], "quarterlyReports": []}


def _balance_sheet(liabs="20000000000", equity="10000000000", assets="30000000000", cash="2000000000"):
    return {"symbol": "X", "annualReports": [{
        "fiscalDateEnding": "2025-12-31", "reportedCurrency": "USD",
        "totalLiabilities": liabs, "totalShareholderEquity": equity,
        "totalAssets": assets, "cashAndCashEquivalentsAtCarryingValue": cash,
    }], "quarterlyReports": []}


def _provider(overview=None, cash_flow=None, balance_sheet=None, price="100.00"):
    """A stand-in for get_av_json that answers each Alpha Vantage function."""
    responses = {
        AV.OVERVIEW: _overview() if overview is None else overview,
        AV.GLOBAL_QUOTE: {"Global Quote": {"05. price": price, "06. volume": "1000000", "10. change percent": "1.5%"}},
        AV.NEWS_SENTIMENT: {"feed": []},
        AV.INSIDER_TRANSACTIONS: {"data": []},
        AV.BALANCE_SHEET: _balance_sheet() if balance_sheet is None else balance_sheet,
        AV.CASH_FLOW: _cash_flow() if cash_flow is None else cash_flow,
    }
    return MagicMock(side_effect=lambda function, **params: responses[function])


def _ingest(app, symbol, provider):
    with app.app_context(), \
            patch("app.services.stock_manager.get_av_json", provider), \
            patch("app.services.stock_manager._ai_executor"):
        result = add_to_master(symbol)
        assert not isinstance(result, dict), result
        return StockMaster.query.filter_by(symbol=symbol).first()


class TestParseProviderNumber:
    @pytest.mark.parametrize("raw", [
        None, "None", "none", "-", "", "   ", "NaN", "nan", "Infinity", "-Infinity",
        "inf", "n/a", "null", "abc", [], {}, float("nan"), float("inf"),
    ])
    def test_placeholders_and_non_finite_values_are_none(self, raw):
        assert parse_provider_number(raw) is None

    @pytest.mark.parametrize("raw, expected", [
        ("0", 0.0), ("12.5", 12.5), ("-3.2", -3.2), (" 7 ", 7.0), (4, 4.0), (0.25, 0.25),
    ])
    def test_real_numbers_parse(self, raw, expected):
        assert parse_provider_number(raw) == pytest.approx(expected)


class TestStatementHelpers:
    def test_fcf_is_operating_cash_flow_minus_capex(self):
        assert calculate_cash_flow_metrics(_cash_flow("1000", "300")) == (700.0, 1000.0, 300.0)

    def test_fcf_is_none_when_capex_is_missing(self):
        # A missing capex used to read as 0, which made FCF equal operating cash flow.
        assert calculate_cash_flow_metrics(_cash_flow("1000", "None")) == (None, 1000.0, None)

    def test_rate_limited_cash_flow_has_no_values(self):
        assert calculate_cash_flow_metrics(RATE_LIMITED) == (None, None, None)

    def test_zero_equity_has_no_ratio(self):
        de_ratio, *_ = calculate_balance_sheet_metrics(_balance_sheet(liabs="500", equity="0"))
        assert de_ratio is None

    def test_missing_equity_has_no_ratio(self):
        de_ratio, _, equity, *_ = calculate_balance_sheet_metrics(_balance_sheet(liabs="500", equity="None"))
        assert de_ratio is None
        assert equity is None

    def test_negative_equity_keeps_its_negative_ratio(self):
        de_ratio, _, equity, *_ = calculate_balance_sheet_metrics(_balance_sheet(liabs="500", equity="-100"))
        assert de_ratio == pytest.approx(-5.0)
        assert equity == pytest.approx(-100.0)

    def test_ordinary_ratio(self):
        de_ratio, *_ = calculate_balance_sheet_metrics(_balance_sheet(liabs="300", equity="200"))
        assert de_ratio == pytest.approx(1.5)


class TestAddToMaster:
    def test_loss_maker_placeholders_are_stored_as_none(self, app):
        overview = _overview(
            PERatio="None", ForwardPE="-", PEGRatio="None", QuarterlyEarningsGrowthYOY="None",
            Beta="NaN", EVToEBITDA="-1.955", DilutedEPSTTM="-1.52", EBITDA="-2100000000",
        )
        stock = _ingest(app, "TLOSS", _provider(overview=overview))

        assert stock.pe_ratio is None
        assert stock.forward_pe is None
        assert stock.peg_ratio is None
        assert stock.eps_growth_qoq is None
        assert stock.beta is None
        # Real negative numbers are kept: their sign is what scoring needs.
        assert stock.ev_to_ebitda == pytest.approx(-1.955)
        assert stock.eps_ttm == pytest.approx(-1.52)
        assert stock.ebitda == pytest.approx(-2.1e9)

    def test_reported_values_are_stored(self, app):
        stock = _ingest(app, "TPROF", _provider())

        assert stock.pe_ratio == pytest.approx(25.4)
        assert stock.market_cap == 50_000_000_000
        assert stock.eps_ttm == pytest.approx(3.10)
        assert stock.free_cash_flow == pytest.approx(3.8e9)
        assert stock.debt_to_equity == pytest.approx(2.0)
        assert stock.buy_ratings_count == 14
        assert stock.hold_ratings_count == 6
        assert stock.sell_ratings_count == 1

    def test_new_row_gets_no_placeholder_zeros(self, app):
        stock = _ingest(app, "TNEW", _provider(overview=_overview(MarketCapitalization="None")))

        # These used to be created as 0.0 and wait for an FMP call that never succeeded.
        assert stock.roic is None
        assert stock.price_to_fc is None
        assert stock.market_cap is None

    def test_missing_analyst_ratings_are_none_not_zero(self, app):
        overview = _overview(
            AnalystRatingStrongBuy=..., AnalystRatingBuy="3",
            AnalystRatingHold=..., AnalystRatingSell="None", AnalystRatingStrongSell=...,
        )
        stock = _ingest(app, "TNEW", _provider(overview=overview))

        assert stock.buy_ratings_count == 3
        assert stock.hold_ratings_count is None
        assert stock.sell_ratings_count is None

    def test_raw_payloads_are_kept(self, app):
        overview, balance_sheet, cash_flow = _overview(), _balance_sheet(), _cash_flow()
        stock = _ingest(app, "TPROF", _provider(overview, cash_flow, balance_sheet))

        assert stock.overview_raw == overview
        assert stock.balance_sheet_history == balance_sheet
        assert stock.cash_flow_history == cash_flow

    def test_rate_limited_refresh_keeps_values_and_fundamentals_clock(self, app):
        _ingest(app, "TRATE", _provider())
        old_clock = datetime.datetime(2020, 1, 1)
        with app.app_context():
            row = StockMaster.query.filter_by(symbol="TRATE").first()
            row.last_fundamental_update = old_clock
            row.last_stock_update = old_clock
            db.session.commit()

        stock = _ingest(app, "TRATE", _provider(
            overview=RATE_LIMITED, cash_flow=RATE_LIMITED, balance_sheet=RATE_LIMITED, price="101.00",
        ))

        assert stock.price == pytest.approx(101.0)
        assert stock.pe_ratio == pytest.approx(25.4)
        assert stock.debt_to_equity == pytest.approx(2.0)
        assert stock.free_cash_flow == pytest.approx(3.8e9)
        assert stock.last_fundamental_update == old_clock
        assert stock.last_stock_update > old_clock

    def test_fresh_fundamentals_move_the_fundamentals_clock(self, app):
        stock = _ingest(app, "TPROF", _provider())
        assert stock.last_fundamental_update is not None

    def test_makes_the_same_six_provider_calls(self, app):
        provider = _provider()
        _ingest(app, "TCALL", provider)

        called = sorted(call.args[0] for call in provider.call_args_list)
        assert called == sorted([
            AV.OVERVIEW, AV.GLOBAL_QUOTE, AV.NEWS_SENTIMENT,
            AV.INSIDER_TRANSACTIONS, AV.BALANCE_SHEET, AV.CASH_FLOW,
        ])


class TestInDepthFinancials:
    def test_fmp_no_longer_overwrites_scoring_columns(self, app):
        with app.app_context():
            db.session.add(StockMaster(
                symbol="TFMP", name="FMP Test", free_cash_flow=100.0, debt_to_equity=1.5,
                roic=None, price_to_fc=None, last_fundamental_update=None, cash_and_equiv=1.0,
            ))
            db.session.commit()

            fmp_row = {
                "freeCashFlow": 999.0, "totalDebt": 50.0, "totalStockholdersEquity": 10.0,
                "roic": 0.42, "pfcfRatio": 12.0, "cashAndCashEquivalents": 5_000_000_000,
            }
            response = MagicMock(status_code=200)
            response.json.return_value = [fmp_row]
            with patch("app.services.alpha_api.requests.get", return_value=response):
                get_in_depth_financials.uncached("TFMP")

            db.session.expire_all()
            stock = StockMaster.query.filter_by(symbol="TFMP").first()
            assert stock.free_cash_flow == pytest.approx(100.0)
            assert stock.debt_to_equity == pytest.approx(1.5)
            assert stock.roic is None
            assert stock.price_to_fc is None
            assert stock.last_fundamental_update is None
            assert stock.cash_and_equiv == pytest.approx(5e9)


class TestAiFallback:
    def test_default_results_carry_no_score(self):
        assert NewsAnalysis().default_result() == {"ai_news_score": None, "ai_news_summary": AI_FALLBACK_SUMMARY}
        assert MoatAnalysis().default_result() == {"ai_moat_score": None, "ai_moat_summary": AI_FALLBACK_SUMMARY}

    def test_failed_analysis_stores_no_score(self, app):
        with app.app_context():
            row = StockMaster(symbol="TAIF", name="AI Fail", ai_news_score=70.0, ai_moat_score=60.0)
            db.session.add(row)
            db.session.commit()
            row_id = row.id

        with patch("app.services.stock_manager.get_news_analysis", return_value=NewsAnalysis().default_result()), \
                patch("app.services.stock_manager.get_moat_analysis", return_value=MoatAnalysis().default_result()), \
                patch("app.services.stock_manager.update_global_and_sector_stats"):
            get_ai_analysis_metrics(app, row_id)

        with app.app_context():
            db.session.expire_all()
            stock = db.session.get(StockMaster, row_id)
            assert stock.ai_news_score is None
            assert stock.ai_moat_score is None
            assert stock.ai_news_summary == AI_FALLBACK_SUMMARY
