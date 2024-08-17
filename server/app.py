# nube comment lol. Use 'source venv/bin/activate' to activate virtual environment
# use python app.py when in server directory to run app
# If using wrong python, run the start_project shell script
from flask import Flask, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import requests

load_dotenv()

app = Flask(__name__)
CORS(app)

@app.route('/api/hello', methods=['GET'])
def hello_world():
    return get_stock_data('MSFT')

def get_stock_data(symbol):
    url = 'https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=' + symbol +'&interval=5min&apikey=Q4DQGD7ASEM0INDB'
    req = requests.get(url)
    data = req.json()
    return data

if __name__ == '__main__':
    app.run(debug=True)