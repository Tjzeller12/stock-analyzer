import datetime
from app import db, cache
from app.models import StockMaster
import requests
import os

ALPHA_VANTAGE_KEY = os.getenv('ALPHA_VANTAGE_KEY')

# Retrieves stock data from Alpha Vantage API using the stocks symbol
@cache.memoize(timeout=900)
def get_stock_data(symbol):
    #Update API URL with stocks symbol
    url = "https://www.alphavantage.co/query?function=OVERVIEW&symbol=" + symbol + "&apikey=" + ALPHA_VANTAGE_KEY
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
    
    url = "https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=" + symbol + "&interval=5min&apikey=" + ALPHA_VANTAGE_KEY
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
    
@cache.memoize(timeout=900)
def get_news_data(filter):
    # If the filter is all then get all news items
    if(filter.lower() == "all"):
        url = "https://www.alphavantage.co/query?function=NEWS_SENTIMENT&apikey=" + ALPHA_VANTAGE_KEY
    else:
        url = "https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=" + filter + "&apikey=" + ALPHA_VANTAGE_KEY
    # request data from API
    req = requests.get(url)
    #Convert it to JSON data
    data = req.json()
    return data

# Safely converts a value to a float
def safe_float(value, default=0.0):
    try:
        return float(value)
    except (ValueError, TypeError):
        return default