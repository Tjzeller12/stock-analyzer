import datetime
from flask import jsonify, Blueprint, request, session, current_app
from app import db, cache
from app.models import GeneralStockNews, User, Portfolio, Stock, StockMaster, Filter
import requests
from sqlalchemy import text, desc
from flask_bcrypt import Bcrypt
from datetime import timedelta
import jwt

# Blueprint orgonizes routes.
bp = Blueprint('main', __name__)

# Attemps to recieve user token from front-end. Quereys that user by ID and returns it.
def get_current_user():
    # Get the token from the Authorization header
    auth_header = request.headers.get('Authorization')
    if auth_header:
        token = auth_header.split(" ")[1]  # Bearer <token>
        try:
            # Decode the token to get the payload (which includes the user_id)
            decoded_token = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = decoded_token.get('user_id')
            
            # Query the user from the database using the extracted user_id
            user = User.query.filter_by(id=user_id).first()
            
            if user:
                print("User found")
                return user
            else:
                print("No user")
        except jwt.ExpiredSignatureError:
            print("Token expired")
            return None  # Handle expired token
        except jwt.InvalidTokenError:
            print("Token not found")
            return None  # Handle invalid token
    return None

# Removes a stock from the users portfolio
@bp.route('/remove', methods=['POST'])
def remove_stock():
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    # Get the symbol from the request
    symbol = request.json.get("symbol")
    if not symbol:
        return jsonify({"error": "No symbol provided"}), 400
    # Get the portfolio from the user
    portfolio = current_user.portfolio
    if not portfolio:
        return jsonify({"error": "User does not have a portfolio"}), 400
    # Join Stock with StockMaster to filter by symbol
    try:
        # Join Stock with StockMaster to filter by symbol
        stock = ( Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id, StockMaster.symbol == symbol).first())

        if not stock:
            return jsonify({"error": f"Stock {symbol} not found in your portfolio."}), 404

        # Delete the stock from the user's portfolio
        db.session.delete(stock)
        db.session.commit()
        db.session.expire_all()
        return jsonify({"success": f"Stock {symbol} removed from your portfolio."}), 200

    except Exception as e:
        db.session.rollback()  # Rollback in case of error
        current_app.logger.error(f"Error removing stock: {e}")
        return jsonify({"error": "An error occurred while removing the stock."}), 500


# Searches for the stock and if it exist it adds it to the users portfolio.
@bp.route('/add', methods=['POST'])
def add_stock_to_portfolio():
    # Get user
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    # Get symbol from request
    symbol = request.json.get("symbol")
    if not symbol:
        return jsonify({"error": "No symbol provided"}), 400
    # Get portfolio from user
    portfolio = current_user.portfolio
    if not portfolio:
        current_app.logger.info("User does not have a portfolio")
        return jsonify({"error": "User does not have a portfolio"}), 400
    # Add stock to portfolio
    result = add_stock(symbol, portfolio.id)
    # Determine the response based on the result
    if "error" in result:
        current_app.logger.error(f"Error adding stock: {result['error']}")
        return jsonify(result), 400
    # Log success
    current_app.logger.info(f"Successfully added stock: {symbol} to portfolio.")
    return jsonify(result), 200

# Recieves a string that states what the user wants to sort the stocks by from the front end and sorts the users porfolio
@bp.route('/stocks', methods=['POST'])
def stock_sort_by():
    # Get sort by
    sort_by = request.json.get("sortBy")
    # Get current user
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    
    portfolio = current_user.portfolio
    if not portfolio:
        return jsonify({"error": "User does not have a portfolio"}), 400
    # Sort stocks by
    try:
        # Check if the sort by is descending
        if sort_by[0] == '-':
            # Sort by descending
            stocks = Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id).order_by(desc(getattr(StockMaster, sort_by[1:]))).all()
        else:
            stocks = Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id).order_by(getattr(StockMaster, sort_by)).all()
        print("Stocks returned.")
        # Return the stocks
        return jsonify([stock.stock_master.to_dict() for stock in stocks])
    # Return error if invalid sort field
    except AttributeError:
        # Return error if invalid sort field
        return jsonify({"error": f"Invalid sort field: {sort_by}"})
    except Exception as e:
        # Log error
        current_app.logger.error(f"Error fetching stocks: {e}")
        # Return error
        return jsonify({"error": "An error occurred while fetching stocks."})

# Updates the stocks in the portfolio
@bp.route('/refresh', methods=['POST'])
@cache.memoize(timeout=900)
def update_stocks():
    # Get current user
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    # Get portfolio from user
    portfolio = current_user.portfolio
    if not portfolio:
        current_app.logger.error(f"Portfolio with id {portfolio.id} not found")
        return jsonify({"error": "User does not have a portfolio"}), 400
    # Get stocks from portfolio
    stocks = ( Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id).all())
    # Update stocks
    for stock in stocks:
        # Get stock data from API
        symbol = stock.stock_master.symbol
        # Fetch updated data from API
        try:
            # Get stock data from API
            data = get_stock_data(symbol)
            # Get stock price from API
            price = get_stock_price(symbol)
            # Check if data is available
            if not data or price is None:
                current_app.logger.warning(f"Data unavailable for symbol: {symbol}")
                continue  # Skip this stock and proceed to the next

            # Update stock master
            db.session.commit()
            db.session.expire_all()
        except Exception as e:
            # Log error
            current_app.logger.error(f"Error updating stock {symbol}: {e}")
            continue  # Log the error and move to the next stock
    # Commit the changes
    db.session.commit()
    # Return success
    return jsonify({'message': 'The stock refresh was successful'}), 200
            
# Retrives stock data from the database given a symbol
@bp.route('/stock_data', methods=['POST'])
def stock_data():
    # Get symbol from request
    symbol = request.json.get("symbol")
    # Log symbol
    print(f"Fetching data for symbol: {symbol}")  # Debug log
    
    # First check if the stock exists in StockMaster
    stock_master = StockMaster.query.filter_by(symbol=symbol).first()
    if not stock_master:
        print(f"Stock {symbol} not found in StockMaster")  # Debug log
        # Try to add it to master
        stock_master = add_to_master(symbol)
        if isinstance(stock_master, dict) and "error" in stock_master:
            return jsonify({"error": stock_master["error"]}), 404

    # Return the stock data directly from StockMaster
    if stock_master:
        stock_data = stock_master.to_dict()
        if stock_master.news:
            stock_data.update(stock_master.news.to_dict())
        print(f"Returning data: {stock_data}")  # Debug log
        return jsonify(stock_data), 200
    
    return jsonify({"error": "Stock not found"}), 404
    
@bp.route('/in_depth_data', methods=['POST'])
def in_depth_data():
    symbol = request.json.get("symbol")
    if not symbol:
        return jsonify({"error": "No symbol provided"}), 400
    
    in_depth_data = get_in_depth_financials(symbol)
    if isinstance(in_depth_data, dict) and "error" in in_depth_data:
        return jsonify(in_depth_data), 404
    
    return jsonify(in_depth_data), 200

# Retrieves news data from Alpha Vantage API
@bp.route('/news', methods=['POST'])
@cache.memoize(timeout=900)
def news_filter_selection():
    
    #Upate API url with selected filter string
    filter = request.json.get("filter")
    current_app.logger.info(f"Filter: {filter}")
    filter_object = Filter.query.filter(db.func.lower(Filter.filter_name) == filter.lower()).first()
    if not filter_object:
        return jsonify({"error": "Filter not found"}), 404
    
    filter_id = filter_object.id
    current_app.logger.info(f"Filter ID: {filter_id}")
    stock_news = GeneralStockNews.query.filter_by(filter_id=filter_id).order_by(desc(GeneralStockNews.last_news_update)).first()
    # If the stock was updated in the last 15 minutes then return the price from the database
    if stock_news and stock_news.last_news_update and stock_news.last_news_update > datetime.datetime.now() - timedelta(minutes=15):
        news_items = GeneralStockNews.query.filter_by(filter_id=filter_id).order_by(desc(GeneralStockNews.last_news_update)).all()
        return jsonify([news_item.to_dict() for news_item in news_items]), 200
    
    # If the filter is all then get all news items
    if(filter.lower() == "all"):
        url = "https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=Q4DQGD7ASEM0INDB"
    else:
        url = "https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=" + filter + "&apikey=Q4DQGD7ASEM0INDB"
    # request data from API
    req = requests.get(url)
    #Convert it to JSON data
    data = req.json()

    #Return the news data
    if data and 'feed' in data:
        # Delete all news items for the filter
        GeneralStockNews.query.filter_by(filter_id=filter_object.id).delete()   
        db.session.commit()

        # Process the news data
        processed_news = []
        for article in data['feed']:
            title = article.get('title', '')
            if title == 'Before you continue':
                continue
            
            # Use f-string for safe printing
            processed_news.append({
                "image_link": article.get('banner_image', ''),
                "link": article.get('url', ''),
                "title": title,
                "news_company": article.get('source', ''),
                "time_published": article.get('time_published', ''),
                "summary": article.get('summary', '')
            })
            stock_news = GeneralStockNews(
                filter_id=filter_id,
                title=title,
                summary=article.get('summary', ''),
                link=article.get('url', ''),
                time_published=article.get('time_published', ''),   
                news_company=article.get('source', ''),
                image_link=article.get('banner_image', ''),
                bias_rating=None,
                last_news_update=datetime.datetime.now()
            )
            db.session.add(stock_news)
            db.session.commit()
            db.session.expire_all()
        
        return jsonify(processed_news), 200
    else:
        return jsonify({"error": "No news found"}), 404
# Retrieves stock data from Alpha Vantage API using the stocks symbol
@cache.memoize(timeout=900)
def get_stock_data(symbol):
    #Update API URL with stocks symbol
    url = "https://www.alphavantage.co/query?function=OVERVIEW&symbol=" + symbol + "&apikey=Q4DQGD7ASEM0INDB"
    # request data from API
    req = requests.get(url)
    #Convert it to JSON data
    data = req.json()
    #Return the stock data
    return data
    
# Retrieves the stocks price from Alpha Vantage API
@cache.memoize(timeout=900)
def get_stock_price(symbol):
    # Update API URL with symbol
    stock_master = StockMaster.query.filter_by(symbol=symbol).first()
    
    url = "https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=" + symbol + "&interval=5min&apikey=Q4DQGD7ASEM0INDB"
    # request data
    req = requests.get(url)
    # convert data tp JSON
    data = req.json()
    # Get time_series data
    time_series = data.get("Time Series (5min)", {})
    # Check if the data exist
    if not time_series:
        print("No time series")
        return None
    # Git the most recent time in data
    most_recent_date = next(iter(time_series))
    #Get most recent data with most recent time
    most_recent_data = time_series[most_recent_date]
    # Return the high during the 5 min interval
    price = most_recent_data.get("2. high", None)
    if price is None:
        print("No high")

    # Update the stock master with the new price
    if stock_master:
        stock_master.price = price
        stock_master.last_stock_update = datetime.datetime.now()
        db.session.commit()

    return price

# Safely converts a value to a float
def safe_float(value, default=0.0):
    try:
        return float(value)
    except (ValueError, TypeError):
        return default
    
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
        
# Retrieves in-depth financial data from the API
@cache.memoize(timeout=900)
def get_in_depth_financials(symbol):
    try:

        
        api_key = "zHCoDbscJgZjgP0WIa1nO8wewFlCoK0H"
        
        # Get the URL for the API
        cf_url = f"https://financialmodelingprep.com/api/v3/cash-flow-statement/{symbol}?limit=1&apikey={api_key}"
        bs_url = f"https://financialmodelingprep.com/api/v3/balance-sheet-statement/{symbol}?limit=1&apikey={api_key}"
        km_url = f"https://financialmodelingprep.com/api/v3/key-metrics/{symbol}?limit=1&apikey={api_key}"

        # Get the response from the API
        cf_response = requests.get(cf_url)
        bs_response = requests.get(bs_url)
        km_response = requests.get(km_url)

        # Check if the response is successful
        if cf_response.status_code != 200 or bs_response.status_code != 200 or km_response.status_code != 200:
            return {"error": f"Failed to fetch in-depth financial data for {symbol}"}
        
        # Get the first item from the response
        cf_data = cf_response.json()[0] if cf_response.json() else {}
        bs_data = bs_response.json()[0] if bs_response.json() else {}
        km_data = km_response.json()[0] if km_response.json() else {}
        stock_master = StockMaster.query.filter_by(symbol=symbol).first()
        if stock_master:

            # Update the stock master with the new in-depth financial data
            stock_master.free_cash_flow = safe_float(cf_data.get("freeCashFlow", 0))
            stock_master.debt_to_equity = safe_float(bs_data.get("totalDebt", 0)) / safe_float(bs_data.get("totalStockholdersEquity", 1))  # Calculated
            stock_master.roic = safe_float(km_data.get("roic", 0))
            stock_master.price_to_fc = safe_float(km_data.get("pfcfRatio", 0))
            stock_master.cashAndCashEquivalents = safe_float(bs_data.get("cashAndCashEquivalents", 0))
            stock_master.last_in_depth_update = datetime.datetime.now()

            db.session.commit()

        return stock_master.to_dict()
    
    except Exception as e:
        db.session.rollback()
        print(f"Error getting in-depth financials: {e}")
        return {"error": f"An error occurred: {str(e)}"}
# Adds a stock to the users portfollio. If the stock is already in their portfolio then it is updated.
def add_stock(symbol, portfolio_id):
    try:
        # Add stock to master
        stock_master = StockMaster.query.filter_by(symbol=symbol).first()
            # if not in stock master
        if not stock_master:
            stock_master = add_to_master(symbol)
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

# Main route
@bp.route('/', methods=['GET'])
def index():
    return "Welcome to the main page"

# test route so we can check if we succesfully connected to the database
@bp.route('/test_db')
def test_db():
    try:
        # attempt to connect to database
        db.session.execute(text('SELECT 1'))
        # print a success method if connection was successful
        return jsonify({'message': 'Database connection successful'}), 200
    except Exception as e:
        # print exception if we are unable to connect to the database
        return jsonify({'error': str(e)}), 500
    
def seed_filters():
    filters = [
        'all',
        'blockchain',
        'earnings',
        'ipo',
        'mergers_and_acquisitions',
        'financial_markets',
        'economy_fiscal',
        'economy_monetary',
        'economy_macro',
        'energy_transportation',
        'finance',
        'life_sciences',
        'manufacturing',
        'real_estate',
        'retail_wholesale',
        'technology'
    ]
    for i, filter in enumerate(filters, start=1):
        if not Filter.query.filter_by(filter_name=filter).first():
            db.session.add(Filter(id=i, filter_name=filter))
    
    db.session.commit()
    db.session.expire_all()