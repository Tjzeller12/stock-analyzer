from flask import jsonify, Blueprint, request
from app import db
from app.models import User, Portfolio, Stock
import requests
from sqlalchemy import text
from flask_bcrypt import Bcrypt
from datetime import date

# Blueprint orgonizes routes.
bp = Blueprint('main', __name__)

@bp.route('/search', methods=['POST'])
def search_stock():
    # Check API if stock exists
    symbol = request.json.get("symbol")
    url = "https://www.alphavantage.co/query?function=OVERVIEW&symbol=" + symbol + "&apikey=Q4DQGD7ASEM0INDB"
    # request data from API
    req = requests.get(url)
    #Convert it to JSON data
    data = req.json()
    # if stock exists add it to the portfolio
    if data:
        # add_stock(symbol)
        return jsonify({"message": "Stock added successfully"}), 200
    else:
        print(f"Stock with symbol {symbol} not found.")
        return jsonify({"error": "Stock not found"}), 404
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
    url = "https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=" + symbol + " &interval=5min&&apikey=Q4DQGD7ASEM0INDB"
    # request data
    req = requests.get(url)
    # convert data tp JSON
    data = req.json()
    # Get time_series data
    time_series = data.get("Time Series (5min)", {})
    # Check if the data exist
    if not time_series:
        return "No data available."
    # Git the most recent time in data
    most_recent_date = next(iter(time_series))
    #Get most recent data with most recent time
    most_recent_data = time_series[most_recent_date]
    # Return the high during the 5 min interval
    return most_recent_data.get("2. high", None)

# Adds a stock to the users portfollio. If the stock is already in their portfolio then it is updated.
def add_stock(symbol, portfolio_id):
    try:

        #Get stock data from API
        data = get_stock_data(symbol)
        price = get_stock_price(symbol)
        
        name = data.get("Name", "N/A")
        industry = data.get("Industry", "N/A")
        ev_to_ebita = float(data.get("EVToEBITDA", 0))
        pe_ratio = float(data.get("PERatio", 0))
        market_cap = float(data.get("MarketCapitalization", 0))
        buy_rating = float(data.get("AnalystRatingStrongBuy", 0))
        hold_rating = float(data.get("AnalystRatingHold", 0))
        sell_rating = float(data.get("AnalystRatingSell", 0))
        dividend_yield = float(data.get("DividendYield", 0))

        #Get the portfolio we are adding data to
        portfolio = Portfolio.query.get(portfolio_id)

        if portfolio:
            
            stock = Stock.query.filter_by(symbol=symbol.first())
            #if stock is not in portfolio
            if stock is None:
                new_stock = Stock(
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