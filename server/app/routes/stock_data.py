import os
import dataclasses
from app.services.search_provider import AlphaVantageStockSearchProvider
import datetime
from flask import jsonify, Blueprint, request, current_app
from app import db, cache
from app.models import GeneralStockNews, StockMaster
from sqlalchemy import desc
from datetime import timedelta
from app.services.alpha_api import *
from app.services.news_manager import *
from app.services.stock_manager import add_to_master
from app.routes.auth import login_required

bp = Blueprint('data', __name__)

# Retrieves news data from Alpha Vantage API
@bp.route('/news', methods=['POST'])
@login_required
def news_filter_selection():

# ... (omitting body for brevity in tool call, but targeting the decorator lines)
    
    #Upate API url with selected filter string
    filter = request.json.get("filter")
    current_app.logger.info(f"Filter: {filter}")
    
    filter_id = get_filter_id(filter)
    current_app.logger.info(f"Filter ID: {filter_id}")
    
    if filter_id is None:
        return jsonify({"error": "Filter not found"}), 404
        
    stock_news = GeneralStockNews.query.filter_by(filter_id=filter_id).order_by(desc(GeneralStockNews.last_news_update)).first()
    # If the stock was updated in the last 15 minutes then return the price from the database
    if stock_news and stock_news.last_news_update and stock_news.last_news_update > datetime.datetime.now() - timedelta(minutes=15):
        news_items = GeneralStockNews.query.filter_by(filter_id=filter_id).order_by(desc(GeneralStockNews.last_news_update)).all()
        return jsonify([news_item.to_dict() for news_item in news_items]), 200
    
    data = get_news_data(filter)

    #Return the news data
    if data and 'feed' in data:
        # Delete all news items for the filter
        GeneralStockNews.query.filter_by(filter_id=filter_id).delete()   
        db.session.commit()

        processed_news = process_news_data(data, filter_id)
        
        return jsonify(processed_news), 200
    else:
        return jsonify({"error": "No news found"}), 404
    
# Retrives stock data from the database given a symbol
@bp.route('/stock_data', methods=['POST'])
@login_required
def stock_data():
    # Get symbol from request
    symbol = request.json.get("symbol")
    # Log symbol
    print(f"Fetching data for symbol: {symbol}")  # Debug log
    
    # First check if the stock exists in StockMaster
    stock_master = StockMaster.query.filter_by(symbol=symbol).first()
    if not stock_master or stock_master.market_cap is None:
        print(f"Stock {symbol} not found in StockMaster or missing flat data")  # Debug log
        # Try to add it to master (or update existing)
        stock_master = add_to_master(symbol)
        if isinstance(stock_master, dict) and "error" in stock_master:
            return jsonify({"error": stock_master["error"]}), 404

    # Return the stock data directly from StockMaster
    if stock_master:
        # Auto-refresh strictly the GLOBAL_QUOTE realtime price if older than 15 minutes
        if not stock_master.last_stock_update or (datetime.datetime.now() - stock_master.last_stock_update).total_seconds() > 900:
            quote_data = get_av_json(AlphaVantageFunction.GLOBAL_QUOTE, symbol=symbol)
            global_quote = quote_data.get("Global Quote", {})
            if global_quote and "05. price" in global_quote:
                new_price = safe_float(global_quote.get("05. price"))
                if new_price > 0:
                    stock_master.price = new_price
                    stock_master.last_stock_update = datetime.datetime.now()
                    db.session.commit()

        stock_data = stock_master.to_dict()
        if stock_master.news:
            stock_data.update(stock_master.news.to_dict())
        print(f"Returning data: {stock_data}")  # Debug log
        return jsonify(stock_data), 200
    
    return jsonify({"error": "Stock not found"}), 404
    
@bp.route('/in_depth_data', methods=['POST'])
@login_required
def in_depth_data():
    symbol = request.json.get("symbol")
    if not symbol:
        return jsonify({"error": "No symbol provided"}), 400
    
    in_depth_data = get_in_depth_financials(symbol)
    if isinstance(in_depth_data, dict) and "error" in in_depth_data:
        # If it's an API error (likely 403), return 500 so frontend doesn't treat it as "not found"
        # Or return 200 with error details so frontend can display "Data unavailable"
        current_app.logger.error(f"FMP API Error: {in_depth_data['error']}")
        return jsonify(in_depth_data), 500
    
    return jsonify(in_depth_data), 200

@bp.route('/chart_data', methods=['POST'])
@login_required
def chart_data():
    symbol = request.json.get("symbol")
    time_frame = request.json.get("timeFrame", "1D")
    
    if not symbol:
        return jsonify({"error": "No symbol provided"}), 400
        
    try:
        if time_frame in ['1D', '1W']:
            data = get_av_json(AlphaVantageFunction.TIME_SERIES_INTRADAY, symbol=symbol, interval='5min', outputsize='full')
            time_series = data.get("Time Series (5min)", {})
            date_format = "%Y-%m-%d %H:%M:%S"
        else:
            outputsize = 'compact' if time_frame in ['1M', '3M'] else 'full'
            data = get_av_json(AlphaVantageFunction.TIME_SERIES_DAILY_ADJUSTED, symbol=symbol, outputsize=outputsize)
            time_series = data.get("Time Series (Daily)", {})
            date_format = "%Y-%m-%d"

        if not time_series:
            if "Information" in data or "Note" in data:
                return jsonify({"error": "API rate limit exceeded. Please try again later."}), 429
            return jsonify({"error": "No time series data available"}), 404

        parsed_data = []
        for dt_str, values in time_series.items():
            dt_obj = datetime.datetime.strptime(dt_str, date_format)
            timestamp = int(dt_obj.timestamp())
            price = safe_float(values.get("5. adjusted close", values.get("4. close", 0)))
            parsed_data.append({"time": timestamp, "value": price})
            
        parsed_data.sort(key=lambda x: x["time"])
        
        if parsed_data:
            last_time = parsed_data[-1]["time"]
            start_time = 0
            
            if time_frame == '1D':
                start_time = last_time - (24 * 60 * 60)
            elif time_frame == '1W':
                start_time = last_time - (7 * 24 * 60 * 60)
            elif time_frame == '1M':
                start_time = last_time - (30 * 24 * 60 * 60)
            elif time_frame == '3M':
                start_time = last_time - (90 * 24 * 60 * 60)
            elif time_frame == '6M':
                start_time = last_time - (180 * 24 * 60 * 60)
            elif time_frame == '1Y':
                start_time = last_time - (365 * 24 * 60 * 60)
            elif time_frame == '5Y':
                start_time = last_time - (5 * 365 * 24 * 60 * 60)
            
            parsed_data = [d for d in parsed_data if d["time"] >= start_time]
        
        return jsonify(parsed_data), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching chart data: {str(e)}")
        return jsonify({"error": str(e)}), 500
@bp.route('/search', methods=['GET'])
@login_required
def search():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'error': 'q is required'}), 400
    provider = AlphaVantageStockSearchProvider(api_key=os.getenv('ALPHA_VANTAGE_KEY'))
    results = provider.search(q)
    return jsonify([dataclasses.asdict(result) for result in results]), 200
