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
            future_monthly = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.TIME_SERIES_MONTHLY, symbol=symbol)
            future_news = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.NEWS_SENTIMENT, tickers=symbol, limit=30)
            future_insider = executor.submit(run_with_context, get_av_json, AlphaVantageFunction.INSIDER_TRANSACTIONS, symbol=symbol)
            future_price = executor.submit(run_with_context, get_stock_price, symbol)

            overview = future_overview.result()
            quote = future_quote.result()
            monthly = future_monthly.result()
            news = future_news.result()
            insider = future_insider.result()
            price = future_price.result()

        if not overview or price is None:
            return {"error": f"API limit reached or data unavailable for symbol: {symbol}"}

        insider_volume = calculate_insider_volume(insider)

        if stock_master:
            stock_master.price = price
            stock_master.company_overview = overview
            stock_master.global_quote = quote
            stock_master.time_series_monthly = monthly
            stock_master.news_sentiment_data = news
            stock_master.insider_volume = insider_volume
            stock_master.last_stock_update = datetime.datetime.now()
        else:   
            # add to stock master    
            stock_master = StockMaster(
                symbol=symbol,
                price=price,

                # Cache the JSON payloads
                company_overview=overview,
                global_quote=quote,
                time_series_monthly=monthly,
                news_sentiment_data=news,
                insider_volume=insider_volume,
                last_stock_update=datetime.datetime.now(),
                
                # Defaults for in-depth financials
                income_statement={},
                cash_flow_history={},
                free_cash_flow=0.0,
                debt_to_equity=0.0,
                roic=0.0,
                price_to_fc=0.0,
                cashAndCashEquivalents=0.0
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