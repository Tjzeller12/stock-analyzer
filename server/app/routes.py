from flask import jsonify, Blueprint
from app import db
from app.models import User
import requests
from sqlalchemy import text

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

# Test route will change very soon
@bp.route('/home', methods=['GET'])
def data_test():
    #Create two user objects
    user_one = User(username='thomas', email='thomaszeller0@gmail.com', password_hash='123', longterm_investor=True)
    user_two = User(username='michael', email='michaelzllr1@gmail.com', password_hash='124', longterm_investor=False)
    #Add the users to the user table
    db.session.add(user_one)
    db.session.add(user_two)
    db.session.commit()
    #Print the entire user table
    print(User.query.all())
    #Test the get_stock_data method
    return jsonify(get_stock_data('MSFT'))

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