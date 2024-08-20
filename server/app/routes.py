from flask import jsonify, Blueprint
from app import db
from app.models import User, Portfolio, Wishlist
import requests
from sqlalchemy import text
from flask_bcrypt import Bcrypt

# Blueprint orgonizes routes.
bp = Blueprint('main', __name__)

# Retrieves stock data from Alpha Vantage API using the stocks symbol
def get_stock_data(symbol):
    #Update API URL with stocks symbol
    url = 'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=' + symbol +'&interval=5min&apikey=Q4DQGD7ASEM0INDB'
    # request data from API
    req = requests.get(url)
    #Convert it to JSON data
    data = req.json()
    #Return the stock data
    return data

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