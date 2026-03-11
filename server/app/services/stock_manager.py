import datetime
import threading
from app import db
from app.models import Stock, StockMaster
import concurrent.futures
from app.constants import AlphaVantageFunction
from app.services.alpha_api import safe_float, get_av_json, get_stock_price
from app.alphaBot import get_moat_analysis, get_news_analysis
from flask import current_app

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
    """Takes AV CASH_FLOW JSON, returns: Free Cash Flow, Operating Cash Flow, CapEx"""
    try:
        latest = cf_json.get("annualReports", [])[0]
        ocf = safe_float(latest.get("operatingCashflow"))
        capex = safe_float(latest.get("capitalExpenditures"))
        return (ocf - capex), ocf, capex
    except (IndexError, AttributeError, TypeError):
        return None, None, None

def calculate_balance_sheet_metrics(bs_json):
    """Takes AV BALANCE_SHEET JSON, returns: Debt-to-Equity, Liabilities, Equity, Assets, Cash"""
    try:
        latest = bs_json.get("annualReports", [])[0]
        liabs = safe_float(latest.get("totalLiabilities"))
        equity = safe_float(latest.get("totalShareholderEquity"))
        assets = safe_float(latest.get("totalAssets"))
        cash = safe_float(latest.get("cashAndCashEquivalentsAtCarryingValue"))
        
        de_ratio = (liabs / equity) if equity and equity != 0 else 0.0
        return de_ratio, liabs, equity, assets, cash
    except (IndexError, AttributeError, TypeError):
        return None, None, None, None, None


# Adds a stock to the MasterStocks
def add_to_master(symbol):
    try:
        stock_master = StockMaster.query.filter_by(symbol=symbol).first()
        app = current_app._get_current_object()

        def run_with_context(func, *args, **kwargs):
            with app.app_context():
                return func(*args, **kwargs)

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            #Get stock data from API
            future_overview = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.OVERVIEW, symbol=symbol)
            future_quote = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.GLOBAL_QUOTE, symbol=symbol)
            future_news = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.NEWS_SENTIMENT, tickers=symbol, limit=30)
            future_insider = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.INSIDER_TRANSACTIONS, symbol=symbol)
            future_price = executor.submit(run_with_context, get_stock_price, symbol)
            future_bs = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.BALANCE_SHEET, symbol=symbol)
            future_cf = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.CASH_FLOW, symbol=symbol)

            overview = future_overview.result()
            quote = future_quote.result()
            news = future_news.result()
            insider = future_insider.result()
            price = future_price.result()
            balance_sheet_json = future_bs.result()
            cash_flow_json = future_cf.result()

        if not overview or price is None:
            return {"error": f"API limit reached or data unavailable for symbol: {symbol}"}

        # Calculate everything using the raw JSON payloads
        insider_volume = calculate_insider_volume(insider)
        fcf, ocf, capex = calculate_cash_flow_metrics(cash_flow_json)
        de_ratio, liabs, equity, assets, cash = calculate_balance_sheet_metrics(balance_sheet_json)

        # Map overview attributes cleanly
        market_cap_val = overview.get("MarketCapitalization")
        market_cap = int(safe_float(market_cap_val)) if market_cap_val else None
        
        global_quote_data = quote.get("Global Quote", {})
        volume_val = global_quote_data.get("06. volume")
        volume = int(safe_float(volume_val)) if volume_val else None

        if stock_master:
            stock_master.price = price
            # Protect against empty responses overriding cache
            if overview and "Information" not in overview and "Note" not in overview and overview.get("Name"):
                stock_master.name = overview.get("Name")
                stock_master.sector = overview.get("Sector")
                stock_master.industry = overview.get("Industry")
                stock_master.description = overview.get("Description")
                stock_master.market_cap = market_cap
                stock_master.pe_ratio = safe_float(overview.get("PERatio"))
                stock_master.forward_pe = safe_float(overview.get("ForwardPE"))
                stock_master.peg_ratio = safe_float(overview.get("PEGRatio"))
                stock_master.ev_to_ebitda = safe_float(overview.get("EVToEBITDA"))
                stock_master.price_to_sales = safe_float(overview.get("PriceToSalesRatioTTM"))
                stock_master.price_to_book = safe_float(overview.get("PriceToBookRatio"))
                stock_master.dividend_yield = safe_float(overview.get("DividendYield"))
                stock_master.roe = safe_float(overview.get("ReturnOnEquityTTM"))
                stock_master.roa = safe_float(overview.get("ReturnOnAssetsTTM"))
                stock_master.operating_margin = safe_float(overview.get("OperatingMarginTTM"))
                stock_master.profit_margin = safe_float(overview.get("ProfitMargin"))
                stock_master.rev_growth_qoq = safe_float(overview.get("QuarterlyRevenueGrowthYOY"))
                stock_master.eps_growth_qoq = safe_float(overview.get("QuarterlyEarningsGrowthYOY"))
                stock_master.beta = safe_float(overview.get("Beta"))
                stock_master.buy_ratings_count = int(safe_float(overview.get("AnalystRatingBuy"))) + int(safe_float(overview.get("AnalystRatingStrongBuy")))
                stock_master.hold_ratings_count = int(safe_float(overview.get("AnalystRatingHold")))
                stock_master.sell_ratings_count = int(safe_float(overview.get("AnalystRatingSell"))) + int(safe_float(overview.get("AnalystRatingStrongSell")))

            if global_quote_data and volume is not None:
                stock_master.price_change_percent = safe_float(global_quote_data.get("10. change percent", "0").replace('%', ''))
                stock_master.volume = volume

            if ocf is not None:
                stock_master.free_cash_flow = fcf
                stock_master.operating_cash_flow = ocf
                stock_master.capital_expenditures = capex
                stock_master.cash_flow_history = cash_flow_json
                
            if assets is not None:
                stock_master.debt_to_equity = de_ratio
                stock_master.total_liabilities = liabs
                stock_master.total_shareholder_equity = equity
                stock_master.total_assets = assets
                stock_master.cash_and_equiv = cash
            
            if news and "Information" not in news:
                stock_master.news_sentiment_data = news
            if insider and "Information" not in insider:
                stock_master.insider_volume = insider_volume
                
            stock_master.last_stock_update = datetime.datetime.now()
        else:   
            # add to stock master    
            stock_master = StockMaster(
                symbol=symbol,
                price=price,
                name=overview.get("Name"),
                sector=overview.get("Sector"),
                industry=overview.get("Industry"),
                description=overview.get("Description"),
                market_cap=market_cap,
                pe_ratio=safe_float(overview.get("PERatio")),
                forward_pe=safe_float(overview.get("ForwardPE")),
                peg_ratio=safe_float(overview.get("PEGRatio")),
                ev_to_ebitda=safe_float(overview.get("EVToEBITDA")),
                price_to_sales=safe_float(overview.get("PriceToSalesRatioTTM")),
                price_to_book=safe_float(overview.get("PriceToBookRatio")),
                dividend_yield=safe_float(overview.get("DividendYield")),
                roe=safe_float(overview.get("ReturnOnEquityTTM")),
                roa=safe_float(overview.get("ReturnOnAssetsTTM")),
                operating_margin=safe_float(overview.get("OperatingMarginTTM")),
                profit_margin=safe_float(overview.get("ProfitMargin")),
                rev_growth_qoq=safe_float(overview.get("QuarterlyRevenueGrowthYOY")),
                eps_growth_qoq=safe_float(overview.get("QuarterlyEarningsGrowthYOY")),
                beta=safe_float(overview.get("Beta")),
                buy_ratings_count=int(safe_float(overview.get("AnalystRatingBuy"))) + int(safe_float(overview.get("AnalystRatingStrongBuy"))),
                hold_ratings_count=int(safe_float(overview.get("AnalystRatingHold"))),
                sell_ratings_count=int(safe_float(overview.get("AnalystRatingSell"))) + int(safe_float(overview.get("AnalystRatingStrongSell"))),
                price_change_percent=safe_float(global_quote_data.get("10. change percent", "0").replace('%', '')),
                volume=volume,
                free_cash_flow=fcf,
                operating_cash_flow=ocf,
                capital_expenditures=capex,
                debt_to_equity=de_ratio,
                total_liabilities=liabs,
                total_shareholder_equity=equity,
                total_assets=assets,
                cash_and_equiv=cash,

                news_sentiment_data=news,
                cash_flow_history=cash_flow_json,
                insider_volume=insider_volume,
                last_stock_update=datetime.datetime.now(),
                
                # Defaults for in-depth financials
                income_statement_history={},
                roic=0.0,
                price_to_fc=0.0,
            )    
            db.session.add(stock_master)

        db.session.commit()

        app = current_app._get_current_object()
        threading.Thread(target=get_ai_analysis_metrics, args=(app, stock_master.id)).start()

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
            news_result = get_news_analysis(stock)
            stock.ai_news_score = news_result.get("ai_news_score", 50)
            stock.ai_news_summary = news_result.get("ai_news_summary", "Analysis failed.")

            # 2. Get Moat
            moat_result = get_moat_analysis(stock)
            stock.ai_moat_score = moat_result.get("ai_moat_score", 50)
            stock.ai_moat_summary = moat_result.get("ai_moat_summary", "Analysis failed.")

            print(f"[{stock.symbol}] AI news and moat analysis complete")
            db.session.commit()
            
        except Exception as e:
            print(f"[{stock.symbol}] Failed to get AI metrics: {e}")
            db.session.rollback()