import datetime
from app import db
from app.models import Stock, StockMaster
from app.services.alpha_api import safe_float, get_stock_data, get_stock_price

# Adds a stock to the MasterStocks
def add_to_master(symbol):
    try:
        stock_master = StockMaster.query.filter_by(symbol=symbol).first()

        #Get stock data from API
        data = get_stock_data(symbol)
        price = get_stock_price(symbol)
        if not data:
            print("Data returned none")
        if price is None:
            print("Price returned none")

        if not data or price is None:
            return {"error": f"API limit reached or data unavailable for symbol: {symbol}"}
        if stock_master:
            stock_master.name = data.get("Name", "N/A")
            stock_master.industry = data.get("Industry", "N/A")
            stock_master.ev_to_ebita = safe_float(data.get("EVToEBITDA", 0))
            stock_master.pe_ratio = safe_float(data.get("PERatio", 0))
            stock_master.market_cap = safe_float(data.get("MarketCapitalization", 0))   
            stock_master.buy_rating = safe_float(data.get("AnalystRatingStrongBuy", 0))
            stock_master.hold_rating = safe_float(data.get("AnalystRatingHold", 0))
            stock_master.sell_rating = safe_float(data.get("AnalystRatingSell", 0))
            stock_master.dividend_yield = safe_float(data.get("DividendYield", 0))
            stock_master.price = price
            stock_master.last_stock_update = datetime.datetime.now()
        else:   
            # add to stock master    
            stock_master = StockMaster(
                symbol=symbol,
                name = data.get("Name", "N/A"),
                industry = data.get("Industry", "N/A"),
                ev_to_ebita = safe_float(data.get("EVToEBITDA", 0)),
                pe_ratio = safe_float(data.get("PERatio", 0)),
                market_cap = safe_float(data.get("MarketCapitalization", 0)),
                buy_rating = safe_float(data.get("AnalystRatingStrongBuy", 0)),
                hold_rating = safe_float(data.get("AnalystRatingHold", 0)),
                sell_rating = safe_float(data.get("AnalystRatingSell", 0)),
                dividend_yield = safe_float(data.get("DividendYield", 0)),
                free_cash_flow = 0.0,
                debt_to_equity = 0.0,
                roic = 0.0,
                price_to_fc = 0.0,
                cashAndCashEquivalents = 0.0,
                price = price,
                last_stock_update = datetime.datetime.now(),
                last_in_depth_update = None
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
        if not stock_master:
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