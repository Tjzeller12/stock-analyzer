"""
test_ingest_retry.py — a stock with no company data is ingested once, not on every view.

ETFs, crypto, and some foreign tickers come back from Alpha Vantage with an
empty OVERVIEW, so they never get a market cap. The stock page and the
watchlist used to re-run the full ingest (6 Alpha Vantage calls, 2 AI calls)
whenever market_cap was None, which burned the quota and then 404'd the page.
Alpha Vantage and the AI analyses are mocked; nothing leaves the process.
"""
import datetime
from unittest.mock import MagicMock, patch

import pytest

from app import cache, db
from app.constants import AlphaVantageFunction as AV
from app.models import Stock, StockMaster
from app.services.alpha_api import is_provider_error
from app.services.stock_manager import add_to_master, needs_ingest

RATE_LIMITED = {"Information": "API rate limit reached."}
TEST_SYMBOLS = ["TETF", "TNEW", "TQUOTA", "TSTORED", "TSEEN", "TLIST"]


@pytest.fixture(autouse=True)
def clean_state(app):
    with app.app_context():
        cache.clear()
    yield
    with app.app_context():
        cache.clear()
        ids = [s.id for s in StockMaster.query.filter(StockMaster.symbol.in_(TEST_SYMBOLS))]
        Stock.query.filter(Stock.stock_master_id.in_(ids)).delete(synchronize_session=False)
        StockMaster.query.filter(StockMaster.symbol.in_(TEST_SYMBOLS)).delete(synchronize_session=False)
        db.session.commit()


def _etf_provider(price="450.00"):
    """Alpha Vantage as it answers for an ETF: a price, and {} for company data."""
    responses = {
        AV.OVERVIEW: {},
        AV.GLOBAL_QUOTE: {"Global Quote": {"05. price": price, "06. volume": "1000", "10. change percent": "0.5%"}},
        AV.NEWS_SENTIMENT: {"feed": []},
        AV.INSIDER_TRANSACTIONS: {"data": []},
        AV.BALANCE_SHEET: {},
        AV.CASH_FLOW: {},
    }
    return MagicMock(side_effect=lambda function, **params: responses[function])


def _quota_provider():
    """Alpha Vantage after the daily quota is gone: every call is a rate-limit note."""
    return MagicMock(return_value=RATE_LIMITED)


def _ingest(app, symbol, provider):
    with app.app_context(), \
            patch("app.services.stock_manager.get_av_json", provider), \
            patch("app.services.stock_manager._ai_executor"):
        return add_to_master(symbol)


def _store(app, **columns):
    with app.app_context():
        db.session.add(StockMaster(**columns))
        db.session.commit()


def _row(app, symbol):
    with app.app_context():
        return StockMaster.query.filter_by(symbol=symbol).first()


class TestIsProviderError:
    @pytest.mark.parametrize("payload", [
        {"Note": "Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day."},
        {"Information": "API rate limit reached."},
        {"Error Message": "Invalid API call."},
        None,
        "not json",
    ])
    def test_failed_requests_are_errors(self, payload):
        assert is_provider_error(payload)

    @pytest.mark.parametrize("payload", [{}, {"Symbol": "AAPL", "Name": "Apple"}, {"annualReports": []}])
    def test_answers_are_not_errors_even_when_empty(self, payload):
        assert not is_provider_error(payload)


class TestNeedsIngest:
    def test_unknown_stock_needs_ingest(self):
        assert needs_ingest(None)

    def test_stock_with_market_cap_does_not(self, app):
        with app.app_context():
            assert not needs_ingest(StockMaster(symbol="TSTORED", market_cap=1e9))

    def test_answered_stock_without_company_data_does_not(self, app):
        with app.app_context():
            stock = StockMaster(symbol="TETF", market_cap=None, last_fundamental_update=datetime.datetime.now())
            assert not needs_ingest(stock)

    def test_never_answered_stock_does(self, app):
        with app.app_context():
            assert needs_ingest(StockMaster(symbol="TQUOTA", market_cap=None))

    def test_failed_attempt_waits_for_the_cooldown(self, app):
        _store(app, symbol="TQUOTA", name="TQUOTA", price=10.0)
        _ingest(app, "TQUOTA", _quota_provider())
        with app.app_context():
            assert not needs_ingest(StockMaster.query.filter_by(symbol="TQUOTA").first())
            cache.clear()  # the cooldown expiring
            assert needs_ingest(StockMaster.query.filter_by(symbol="TQUOTA").first())


class TestFundamentalsClock:
    def test_etf_answer_sets_the_clock_without_a_market_cap(self, app):
        result = _ingest(app, "TETF", _etf_provider())
        assert not isinstance(result, dict), result

        stock = _row(app, "TETF")
        assert stock.market_cap is None
        assert stock.price == pytest.approx(450.0)
        assert stock.last_fundamental_update is not None
        with app.app_context():
            cache.clear()  # not the cooldown: the answer itself ends the retries
            assert not needs_ingest(stock)

    def test_rate_limited_overview_leaves_the_clock_unset(self, app):
        provider = _etf_provider()
        responses = {AV.OVERVIEW: RATE_LIMITED}
        rate_limited = MagicMock(side_effect=lambda function, **params:
                                 responses.get(function) or provider(function, **params))
        _ingest(app, "TNEW", rate_limited)

        assert _row(app, "TNEW").last_fundamental_update is None

    def test_failed_quote_logs_why_ingest_stopped(self, app):
        with patch.object(app.logger, "warning") as warning:
            result = _ingest(app, "TQUOTA", _quota_provider())

        assert isinstance(result, dict) and "error" in result
        warning.assert_called_once()
        assert "TQUOTA" in warning.call_args.args
        assert "provider error" in warning.call_args.args


class TestStockPage:
    def test_stored_etf_is_served_without_provider_calls(self, client, auth_headers, app):
        _store(app, symbol="TETF", name="Test ETF", price=450.0,
               last_fundamental_update=datetime.datetime.now(), last_stock_update=datetime.datetime.now())

        with patch("app.routes.stock_data.add_to_master") as ingest:
            resp = client.post("/data/stock_data", json={"symbol": "TETF"}, headers=auth_headers)

        assert resp.status_code == 200
        assert resp.get_json()["symbol"] == "TETF"
        ingest.assert_not_called()

    def test_failed_refresh_serves_the_stored_row_instead_of_404(self, client, auth_headers, app):
        _store(app, symbol="TSTORED", name="Stored Co", price=12.0, last_stock_update=datetime.datetime.now())

        with patch("app.routes.stock_data.add_to_master", return_value={"error": "API limit reached"}):
            resp = client.post("/data/stock_data", json={"symbol": "TSTORED"}, headers=auth_headers)

        assert resp.status_code == 200
        assert resp.get_json()["price"] == pytest.approx(12.0)

    def test_second_open_within_cooldown_makes_no_provider_calls(self, client, auth_headers, app):
        _store(app, symbol="TSEEN", name="Seen Co", price=5.0, last_stock_update=datetime.datetime.now())
        provider = _quota_provider()

        with patch("app.services.stock_manager.get_av_json", provider), \
                patch("app.services.stock_manager._ai_executor"):
            first = client.post("/data/stock_data", json={"symbol": "TSEEN"}, headers=auth_headers)
            calls_after_first = provider.call_count
            second = client.post("/data/stock_data", json={"symbol": "TSEEN"}, headers=auth_headers)

        assert first.status_code == 200 and second.status_code == 200
        assert calls_after_first == 6
        assert provider.call_count == calls_after_first

    def test_unknown_symbol_that_fails_is_still_404(self, client, auth_headers):
        with patch("app.routes.stock_data.add_to_master", return_value={"error": "Symbol not found"}):
            resp = client.post("/data/stock_data", json={"symbol": "TNEW"}, headers=auth_headers)

        assert resp.status_code == 404


class TestWatchlist:
    def test_listing_does_not_reingest_a_stored_etf(self, client, auth_headers, app):
        _store(app, symbol="TLIST", name="Listed ETF", price=100.0,
               last_fundamental_update=datetime.datetime.now(), last_stock_update=datetime.datetime.now())
        added = client.post("/portfolio/add", json={"symbol": "TLIST"}, headers=auth_headers)
        assert added.status_code == 200, added.get_json()

        with patch("app.routes.portfolio.add_to_master") as ingest:
            resp = client.post("/portfolio/stocks", json={"sortBy": "symbol"}, headers=auth_headers)

        assert [s["symbol"] for s in resp.get_json()] == ["TLIST"]
        ingest.assert_not_called()
