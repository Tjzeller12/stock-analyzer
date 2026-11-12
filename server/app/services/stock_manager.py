import datetime
from app import db
from app.models import Stock, StockMaster
import concurrent.futures
from app.constants import AlphaVantageFunction
from app.services.alpha_api import safe_float, parse_provider_number, get_av_json, get_stock_price
from app.alphaBot import get_moat_analysis, get_news_analysis
from app.alphaBot.analysis import AI_FALLBACK_SUMMARY
from flask import current_app
from app.utils.normalization import update_global_and_sector_stats

# Bounded thread pool for AI analysis background tasks.
# Caps concurrent AI calls at 4 to prevent unbounded thread/memory growth.
_ai_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

# Calculates the insider net volume by looping through eact transaction and addting it to the total volume
def calculate_insider_volume(insider_data):
    """Calculates net transaction volume from standard AV INSIDER_TRANSACTIONS payload"""
    transactions = insider_data.get("data", [])
    net_volume = 0.0
    for t in transactions:
        shares = safe_float(t.get("shares", 0))
        # acquisitions usually 'A', disposals 'D'
        acq_disp = t.get("acquisition_or_disposal", "A") 
        if acq_disp.upper() == "D":
            net_volume -= shares
        else:
            net_volume += shares
    return net_volume

def calculate_cash_flow_metrics(cf_json):
    """
    Takes AV CASH_FLOW JSON, returns: Free Cash Flow, Operating Cash Flow, CapEx.

    A value the provider didn't report is None. FCF needs both inputs: a missing
    capex used to read as 0 and made FCF equal operating cash flow.
    """
    try:
        latest = cf_json.get("annualReports", [])[0]
        ocf = parse_provider_number(latest.get("operatingCashflow"))
        capex = parse_provider_number(latest.get("capitalExpenditures"))
    except (IndexError, AttributeError, TypeError):
        return None, None, None
    fcf = (ocf - capex) if ocf is not None and capex is not None else None
    return fcf, ocf, capex

def calculate_balance_sheet_metrics(bs_json):
    """Takes AV BALANCE_SHEET JSON, returns: Debt-to-Equity, Liabilities, Equity, Assets, Cash"""
    try:
        latest = bs_json.get("annualReports", [])[0]
        liabs = parse_provider_number(latest.get("totalLiabilities"))
        equity = parse_provider_number(latest.get("totalShareholderEquity"))
        assets = parse_provider_number(latest.get("totalAssets"))
        cash = parse_provider_number(latest.get("cashAndCashEquivalentsAtCarryingValue"))
    except (IndexError, AttributeError, TypeError):
        return None, None, None, None, None

    # Still liabilities over equity; the true debt ratio is a later change
    # (planning/14-radar-scoring-refinement/phase-1-design.md §0.2). Zero or
    # unknown equity has no ratio: the old 0.0 ranked as the least leveraged
    # company there is. Negative equity keeps its negative ratio, and the
    # scoring layer reads the sign of equity to treat it as unfavorable.
    de_ratio = (liabs / equity) if liabs is not None and equity not in (None, 0) else None
    return de_ratio, liabs, equity, assets, cash


def _has_annual_reports(statement_json):
    """True when a statement payload carries data, not a rate-limit note or an empty body."""
    return isinstance(statement_json, dict) and bool(statement_json.get("annualReports"))


def _analyst_count(overview, *keys):
    """Sum of the given analyst-rating counts, or None when none of them was reported."""
    reported = [v for v in (parse_provider_number(overview.get(k)) for k in keys) if v is not None]
    return int(sum(reported)) if reported else None


def _overview_fields(overview):
    """
    StockMaster columns read from an AV OVERVIEW payload.

    Anything the provider didn't report is None, never 0.0. Provider field names
    stay in this module so the data source can be swapped later.
    """
    def num(key):
        return parse_provider_number(overview.get(key))

    market_cap = num("MarketCapitalization")
    return {
        "name": overview.get("Name"),
        "sector": overview.get("Sector"),
        "industry": overview.get("Industry"),
        "description": overview.get("Description"),
        "market_cap": int(market_cap) if market_cap is not None else None,
        "pe_ratio": num("PERatio"),
        "forward_pe": num("ForwardPE"),
        "peg_ratio": num("PEGRatio"),
        "ev_to_ebitda": num("EVToEBITDA"),
        "price_to_sales": num("PriceToSalesRatioTTM"),
        "price_to_book": num("PriceToBookRatio"),
        "dividend_yield": num("DividendYield"),
        "roe": num("ReturnOnEquityTTM"),
        "roa": num("ReturnOnAssetsTTM"),
        "operating_margin": num("OperatingMarginTTM"),
        "profit_margin": num("ProfitMargin"),
        "rev_growth_qoq": num("QuarterlyRevenueGrowthYOY"),
        "eps_growth_qoq": num("QuarterlyEarningsGrowthYOY"),
        "beta": num("Beta"),
        # Signs the scoring layer needs: a loss-maker's P/E and a negative
        # EBITDA's EV/EBITDA must rank as expensive, not as missing or cheap.
        "eps_ttm": num("DilutedEPSTTM"),
        "ebitda": num("EBITDA"),
        "buy_ratings_count": _analyst_count(overview, "AnalystRatingBuy", "AnalystRatingStrongBuy"),
        "hold_ratings_count": _analyst_count(overview, "AnalystRatingHold"),
        "sell_ratings_count": _analyst_count(overview, "AnalystRatingSell", "AnalystRatingStrongSell"),
        "overview_raw": overview,
    }


# Adds a stock to the MasterStocks
def add_to_master(symbol):
    try:
        stock_master = StockMaster.query.filter_by(symbol=symbol).first()
        app = current_app._get_current_object()

        def run_with_context(func, *args, **kwargs):
            with app.app_context():
                return func(*args, **kwargs)

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            future_overview = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.OVERVIEW, symbol=symbol)
            future_quote = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.GLOBAL_QUOTE, symbol=symbol)
            future_news = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.NEWS_SENTIMENT, tickers=symbol, limit=30)
            future_insider = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.INSIDER_TRANSACTIONS, symbol=symbol)
            future_bs = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.BALANCE_SHEET, symbol=symbol)
            future_cf = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.CASH_FLOW, symbol=symbol)

            overview = future_overview.result()
            quote = future_quote.result()
            news = future_news.result()
            insider = future_insider.result()
            balance_sheet_json = future_bs.result()
            cash_flow_json = future_cf.result()

        # Derive price from GLOBAL_QUOTE (already fetched) instead of a
        # separate TIME_SERIES_DAILY call, which was the 7th concurrent
        # request and frequently triggered Alpha Vantage burst-rate limits.
        global_quote_data = quote.get("Global Quote", {}) if quote else {}
        # default=None (not 0.0) so a missing/rate-limited quote is detectable and
        # we DON'T overwrite a previously-good price with 0 below (P: no false zeros).
        price = safe_float(global_quote_data.get("05. price"), default=None)

        # Price is the hard requirement — no price means invalid symbol or full rate limit.
        if not price:
            return {"error": f"Price unavailable or API limit reached for symbol: {symbol}"}

        # Overview is optional: ETFs (USO, SPY, etc.) return {} from AV.
        # We still add them — they just won't have fundamental metrics.
        overview_has_data = (
            bool(overview)
            and "Information" not in overview
            and "Note" not in overview
            and bool(overview.get("Name"))
        )

        # One field map for new and existing rows, so both follow the same
        # rules: a payload that came back empty or rate-limited leaves the
        # stored values alone, and a value the provider didn't report is None.
        volume_val = global_quote_data.get("06. volume")
        volume = int(safe_float(volume_val)) if volume_val else None
        cash_flow_ok = _has_annual_reports(cash_flow_json)
        balance_sheet_ok = _has_annual_reports(balance_sheet_json)

        fields = {"price": price}
        if overview_has_data:
            fields.update(_overview_fields(overview))

        if global_quote_data and volume is not None:
            fields["price_change_percent"] = safe_float(global_quote_data.get("10. change percent", "0").replace('%', ''))
            fields["volume"] = volume

        if cash_flow_ok:
            fcf, ocf, capex = calculate_cash_flow_metrics(cash_flow_json)
            fields.update(
                free_cash_flow=fcf,
                operating_cash_flow=ocf,
                capital_expenditures=capex,
                cash_flow_history=cash_flow_json,
            )

        if balance_sheet_ok:
            de_ratio, liabs, equity, assets, cash = calculate_balance_sheet_metrics(balance_sheet_json)
            fields.update(
                debt_to_equity=de_ratio,
                total_liabilities=liabs,
                total_shareholder_equity=equity,
                total_assets=assets,
                cash_and_equiv=cash,
                balance_sheet_history=balance_sheet_json,
            )

        if news and "Information" not in news:
            fields["news_sentiment_data"] = news
        if insider and "Information" not in insider:
            fields["insider_volume"] = calculate_insider_volume(insider)

        now = datetime.datetime.now()
        fields["last_stock_update"] = now
        # The fundamentals clock moves only when fundamentals actually arrived,
        # so a rate-limited refresh no longer makes old numbers look new.
        if overview_has_data and (cash_flow_ok or balance_sheet_ok):
            fields["last_fundamental_update"] = now

        if not stock_master:
            stock_master = StockMaster(symbol=symbol, name=symbol, income_statement_history={})
            db.session.add(stock_master)
        for column, value in fields.items():
            setattr(stock_master, column, value)

        db.session.commit()

        app = current_app._get_current_object()
        _ai_executor.submit(get_ai_analysis_metrics, app, stock_master.id)

        db.session.expire_all()
        return stock_master
    except Exception as e:
        db.session.rollback()
        print(f"Error adding stock to master: {e}")
        return {"error": f"An error occurred: {str(e)}"}
# Adds a stock to the users portfollio. If the stock is already in their portfolio then it is updated.
def add_stock(symbol, portfolio_id):
    
    try:
        # Add stock to master
        stock_master = StockMaster.query.filter_by(symbol=symbol).first()
            # if not in stock master
        if not stock_master or not stock_master.last_stock_update or (datetime.datetime.now() - stock_master.last_stock_update).days > 7:
            stock_master = add_to_master(symbol)
            # Check if add_to_master returned an error dict
            if isinstance(stock_master, dict):
                return stock_master
        
        # check if stock is in portfolio
        existing_stock = Stock.query.filter(Stock.portfolio_id == portfolio_id, Stock.stock_master_id == stock_master.id).first()
        if existing_stock:
            return {"message": f"Stock {symbol} is already in your portfolio."}
        
        new_stock = Stock(
            portfolio_id=portfolio_id,
            stock_master_id=stock_master.id
        )

        db.session.add(new_stock)
        db.session.commit()
        db.session.expire_all()
        return {"message": f"Stock {symbol} added to your portfolio."}
    
    except Exception as e:
        db.session.rollback()  # Rollback to maintain database consistency
        print(f"Error adding stock: {e}")
        return {"error": f"An error occurred: {str(e)}"}

def get_ai_analysis_metrics(app, stock_id):
    # We use the app context so the DB session stays alive in the background
    with app.app_context():
        # Fetch the stock fresh using the ID
        stock = StockMaster.query.get(stock_id)
        if not stock:
            return

        try:
            # 1. Get News
            # A missing score stays empty. A default of 50 ranked as a real opinion.
            news_result = get_news_analysis(stock)
            stock.ai_news_score = news_result.get("ai_news_score")
            stock.ai_news_summary = news_result.get("ai_news_summary", AI_FALLBACK_SUMMARY)

            # 2. Get Moat
            moat_result = get_moat_analysis(stock)
            stock.ai_moat_score = moat_result.get("ai_moat_score")
            stock.ai_moat_summary = moat_result.get("ai_moat_summary", AI_FALLBACK_SUMMARY)

            print(f"[{stock.symbol}] AI news and moat analysis complete")
            db.session.commit()

            update_global_and_sector_stats(sector=stock.sector, industry=stock.industry)
            
        except Exception as e:
            print(f"[{stock.symbol}] Failed to get AI metrics: {e}")
            db.session.rollback()