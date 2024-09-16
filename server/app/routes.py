from flask import jsonify, Blueprint, request, session, current_app
from app import db
from app.models import User, Portfolio, Stock
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

# Searches for the stock and if it exist it adds it to the users portfolio.
@bp.route('/search', methods=['POST'])
def search_stock():
    # Get user
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    # Check API if stock exists
    symbol = request.json.get("symbol")
    if not symbol:
        return jsonify({"error": "No symbol provided"}), 400
    url = "https://www.alphavantage.co/query?function=OVERVIEW&symbol=" + symbol + "&apikey=Q4DQGD7ASEM0INDB"
    # request data from API
    req = requests.get(url)
    #Convert it to JSON data
    data = req.json()
    print(data)
    # if stock exists add it to the portfolio
    if data and 'Symbol' in data:
        portfolio = current_user.portfolio
        if portfolio:
            # Add stock to portfolio
            add_stock(symbol, portfolio.id)
            return jsonify({"message": "Stock added successfully"}), 200
        else:
            return jsonify({"error": "User does not have a portfolio"}), 400
    else:
        print(f"Stock with symbol {symbol} not found.")
        return jsonify({"error": "Stock not found"}), 404

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
    if portfolio:
        update_stocks(portfolio.id)
        stocks = Stock.query.filter_by(portfolio_id=portfolio.id).order_by(desc(getattr(Stock, sort_by))).all()
        print("Stocks returned.")
        return jsonify([stock.to_dict() for stock in stocks])
    else:
        return jsonify({"error": "User does not have a portfolio"}), 400

# Updates the stocks in the portfolio
def update_stocks(portfolio_id):
    portfolio = Portfolio.query.get(portfolio_id)
    if portfolio:
        for stock in portfolio.stocks:
            add_stock(stock.symbol, portfolio_id)
    else:
        current_app.logger.error(f"Portfolio with id {portfolio_id} not found")

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

# Adds a stock to the users portfollio. If the stock is already in their portfolio then it is updated.
def add_stock(symbol, portfolio_id):
    try:
        #Get stock data from API
        data = get_stock_data(symbol)
        price = get_stock_price(symbol)
        if not data:
            print("Data returned none")
        if price is None:
            print("Price returned none")
        if not data or price is None:
            print(f"API limit reached or data unavailable for symbol: {symbol}")
            return
        
        name = data.get("Name", "N/A")
        industry = data.get("Industry", "N/A")
        ev_to_ebita = safe_float(data.get("EVToEBITDA", 0))
        pe_ratio = safe_float(data.get("PERatio", 0))
        market_cap = safe_float(data.get("MarketCapitalization", 0))
        buy_rating = safe_float(data.get("AnalystRatingStrongBuy", 0))
        hold_rating = safe_float(data.get("AnalystRatingHold", 0))
        sell_rating = safe_float(data.get("AnalystRatingSell", 0))
        dividend_yield = safe_float(data.get("DividendYield", 0))

        #Get the portfolio we are adding data to
        portfolio = Portfolio.query.get(portfolio_id)

        if portfolio:
            
            stock = Stock.query.filter_by(symbol=symbol, portfolio_id=portfolio_id).first()
            #if stock is not in portfolio
            if stock is None:
                new_stock = Stock(
                    portfolio_id=portfolio_id,
                    symbol=symbol,
                    name=name,
                    industry=industry,
                    ev_to_ebita=ev_to_ebita,
                    pe_ratio=pe_ratio,
                    price=price,
                    market_cap=market_cap,
                    buy_rating=buy_rating,
                    hold_rating=hold_rating,
                    sell_rating=sell_rating,
                    dividend_yield=dividend_yield
                )

                portfolio.stocks.append(new_stock)
                db.session.add(new_stock)

                print(f"Stock {symbol} added successfully.")
            else:

                #Update each value of the stock
                stock.industry = industry
                stock.ev_to_ebita = ev_to_ebita
                stock.pe_ratio = pe_ratio
                stock.market_cap = market_cap
                stock.buy_rating = buy_rating
                stock.hold_rating = hold_rating
                stock.sell_rating = sell_rating
                stock.dividend_yield = dividend_yield

                print(f"Stock {symbol} updated successfully.")
            
            #Commit the transaction
            db.session.commit()
        else:
            print(f"Stock with symbol {symbol} not found.")
    except Exception as e:
        print(f"Error adding stock: {e}")

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