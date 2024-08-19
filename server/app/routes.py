from flask import jsonify, Blueprint
from app import db
from app.models import User
import requests
from sqlalchemy import text

bp = Blueprint('main', __name__)

def get_stock_data(symbol):
    url = 'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=' + symbol +'&interval=5min&apikey=Q4DQGD7ASEM0INDB'
    req = requests.get(url)
    data = req.json()
    return data


@bp.route('/home', methods=['GET'])
def data_test():
    user_one = User(username='thomas', email='thomaszeller0@gmail.com', password_hash='123', longterm_investor=True)
    user_two = User(username='michael', email='michaelzllr1@gmail.com', password_hash='124', longterm_investor=False)
    db.session.add(user_one)
    db.session.add(user_two)
    db.session.commit()
    print(User.query.all())
    return jsonify(get_stock_data('MSFT'))

# test route so we can check if we succesfully connected to the database

@bp.route('/test_db')
def test_db():
    try:
        db.session.execute(text('SELECT 1'))
        return jsonify({'message': 'Database connection successful'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500