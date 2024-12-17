from flask import jsonify, Blueprint, request, session, current_app
from app import db
from app.models import User, Portfolio, Stock, StockMaster
import requests
from sqlalchemy import text, desc
from flask_bcrypt import Bcrypt
from datetime import date
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
@bp.route('/remove', methods=['POST'])
def remove_stock():
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    symbol = request.json.get("symbol")
    if not symbol:
        return jsonify({"error": "No symbol provided"}), 400
    portfolio = current_user.portfolio
    if not portfolio:
        return jsonify({"error": "User does not have a portfolio"}), 400
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
    # Check API if stock exists
    symbol = request.json.get("symbol")
    if not symbol:
        return jsonify({"error": "No symbol provided"}), 400
    portfolio = current_user.portfolio
    if not portfolio:
        current_app.logger.info("User does not have a portfolio")
        return jsonify({"error": "User does not have a portfolio"}), 400
    result = add_stock(symbol, portfolio.id)
    # Determine the response based on the result
    if "error" in result:
        current_app.logger.error(f"Error adding stock: {result['error']}")
        return jsonify(result), 400
    current_app.logger.info(f"Successfully added stock: {symbol} to portfolio.")
    return jsonify(result), 200

#Recieves a string that states what the user wants to sort the stocks by from the front end and sorts the users porfolio
@bp.route('/stocks', methods=['POST'])
def stock_sort_by():
    #Get sort by
    sort_by = request.json.get("sortBy")
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    
    portfolio = current_user.portfolio
    if not portfolio:
        return jsonify({"error": "User does not have a portfolio"}), 400
    try:
        if sort_by[0] == '-':
            stocks = Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id).order_by(desc(getattr(StockMaster, sort_by[1:]))).all()
        else:
            stocks = Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id).order_by(getattr(StockMaster, sort_by)).all()
        print("Stocks returned.")
        return jsonify([stock.stock_master.to_dict() for stock in stocks])

    except AttributeError:
        return jsonify({"error": f"Invalid sort field: {sort_by}"})
    except Exception as e:
        current_app.logger.error(f"Error fetching stocks: {e}")
        return jsonify({"error": "An error occurred while fetching stocks."})

# Updates the stocks in the portfolio
@bp.route('/refresh', methods=['POST'])
def update_stocks():
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    portfolio = current_user.portfolio
    if not portfolio:
        current_app.logger.error(f"Portfolio with id {portfolio.id} not found")
        return jsonify({"error": "User does not have a portfolio"}), 400
    stocks = stock = ( Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id).all())
    for stock in stocks:
        #Get stock data from API
        symbol = stock.stock_master.symbol
        # Fetch updated data from API
        try:
            data = get_stock_data(symbol)
            price = get_stock_price(symbol)

            if not data or price is None:
                current_app.logger.warning(f"Data unavailable for symbol: {symbol}")
                continue  # Skip this stock and proceed to the next

            # Update StockMaster fields
            stock.stock_master.name = data.get("Name", "N/A")
            stock.stock_master.industry = data.get("Industry", "N/A")
            stock.stock_master.ev_to_ebita = safe_float(data.get("EVToEBITDA", 0))
            stock.stock_master.pe_ratio = safe_float(data.get("PERatio", 0))
            stock.stock_master.market_cap = safe_float(data.get("MarketCapitalization", 0))
            stock.stock_master.buy_rating = safe_float(data.get("AnalystRatingStrongBuy", 0))
            stock.stock_master.hold_rating = safe_float(data.get("AnalystRatingHold", 0))
            stock.stock_master.sell_rating = safe_float(data.get("AnalystRatingSell", 0))
            stock.stock_master.dividend_yield = safe_float(data.get("DividendYield", 0))
            stock.stock_master.price = price

        except Exception as e:
            current_app.logger.error(f"Error updating stock {symbol}: {e}")
            continue  # Log the error and move to the next stock
    db.session.commit()
    return jsonify({'message': 'The stock refresh was successful'}), 200
            

# Retrieves news data from Alpha Vantage API
@bp.route('/news', methods=['POST'])
def news_filter_selection():
    #Upate API url with selected filter string
    filter = request.json.get("filter")
    if(filter == "all"):
        url = "https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=Q4DQGD7ASEM0INDB"
    else:
        url = "https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=" + filter + "&apikey=Q4DQGD7ASEM0INDB"
    # request data from API
    req = requests.get(url)
    #Convert it to JSON data
    data = req.json()

    
    #Return the news data
    if data and 'feed' in data:
        
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
        return jsonify(processed_news), 200
    else:
        return jsonify({"error": "No news found"}), 404
# Retrieves stock data from Alpha Vantage API using the stocks symbol
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
def get_stock_price(symbol):
    # Update API URL with symbol
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
        #Get stock data from API
        data = get_stock_data(symbol)
        price = get_stock_price(symbol)
        if not data:
            print("Data returned none")
        if price is None:
            print("Price returned none")
        if not data or price is None:
            return {"error": f"API limit reached or data unavailable for symbol: {symbol}"}
        # add to stock master    
        stock = StockMaster(
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
            price = price
        )
        db.session.add(stock)
        db.session.commit()
        db.session.expire_all()
        return stock
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
        # check if stock is in portfolio
        existing_stock = Stock.query.filter(Stock.portfolio_id == portfolio_id, Stock.stock_master_id == stock_master.id).first()
        if existing_stock:
            return {"message": f"Stock {symbol} is already in your portfolio."}
        new_stock = Stock(
            portfolio_id=portfolio_id,
            stock_master_id=stock_master.id,
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