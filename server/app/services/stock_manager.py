import datetime
from app import db
from app.models import Stock, StockMaster
import concurrent.futures
from app.constants import AlphaVantageFunction
from app.services.alpha_api import safe_float, get_av_json, get_stock_price
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


# Adds a stock to the MasterStocks
def add_to_master(symbol):
    try:
        stock_master = StockMaster.query.filter_by(symbol=symbol).first()
        app = current_app._get_current_object()

        def run_with_context(func, *args, **kwargs):
            with app.app_context():
                return func(*args, **kwargs)

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            #Get stock data from API
            future_overview = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.OVERVIEW, symbol=symbol)
            future_quote = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.GLOBAL_QUOTE, symbol=symbol)
            future_news = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.NEWS_SENTIMENT, tickers=symbol, limit=30)
            future_insider = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.INSIDER_TRANSACTIONS, symbol=symbol)
            future_price = executor.submit(run_with_context, get_stock_price, symbol)

            overview = future_overview.result()
            quote = future_quote.result()
            news = future_news.result()
            insider = future_insider.result()
            price = future_price.result()

        if not overview or price is None:
            return {"error": f"API limit reached or data unavailable for symbol: {symbol}"}

        insider_volume = calculate_insider_volume(insider)

        # Map overview attributes cleanly
        market_cap_val = overview.get("MarketCapitalization")
        market_cap = int(safe_float(market_cap_val)) if market_cap_val else None
        
        global_quote_data = quote.get("Global Quote", {})
        volume_val = global_quote_data.get("06. volume")
        volume = int(safe_float(volume_val)) if volume_val else None

        if stock_master:
            stock_master.price = price
            stock_master.name = overview.get("Name")
            stock_master.sector = overview.get("Sector")
            stock_master.industry = overview.get("Industry")
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
            stock_master.price_change_percent = safe_float(global_quote_data.get("10. change percent", "0").replace('%', ''))
            stock_master.volume = volume
            
            stock_master.news_sentiment_data = news
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

                news_sentiment_data=news,
                insider_volume=insider_volume,
                last_stock_update=datetime.datetime.now(),
                
                # Defaults for in-depth financials
                income_statement_history={},
                cash_flow_history={},
                free_cash_flow=0.0,
                debt_to_equity=0.0,
                roic=0.0,
                price_to_fc=0.0,
                cash_and_equiv=0.0
            )    
            db.session.add(stock_master)

        db.session.commit()
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