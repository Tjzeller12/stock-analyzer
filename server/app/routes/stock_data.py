import datetime
from flask import jsonify, Blueprint, request, current_app
from app import db, cache
from app.models import GeneralStockNews, StockMaster
from sqlalchemy import desc
from datetime import timedelta
from app.services.alpha_api import *
from app.services.news_manager import *
from app.services.stock_manager import add_to_master

bp = Blueprint('data', __name__)

# Retrieves news data from Alpha Vantage API
@bp.route('/news', methods=['POST'])
@cache.memoize(timeout=900)
def news_filter_selection():
    
    #Upate API url with selected filter string
    filter = request.json.get("filter")
    current_app.logger.info(f"Filter: {filter}")
    
    filter_id = get_filter_id(filter)
    current_app.logger.info(f"Filter ID: {filter_id}")
    stock_news = GeneralStockNews.query.filter_by(filter_id=filter_id).order_by(desc(GeneralStockNews.last_news_update)).first()
    # If the stock was updated in the last 15 minutes then return the price from the database
    if stock_news and stock_news.last_news_update and stock_news.last_news_update > datetime.datetime.now() - timedelta(minutes=15):
        news_items = GeneralStockNews.query.filter_by(filter_id=filter_id).order_by(desc(GeneralStockNews.last_news_update)).all()
        return jsonify([news_item.to_dict() for news_item in news_items]), 200
    
    data = get_news_data(filter, filter_id)

    #Return the news data
    if data and 'feed' in data:
        # Delete all news items for the filter
        GeneralStockNews.query.filter_by(filter_id=filter_id).delete()   
        db.session.commit()

        processed_news = process_news_data(data)
        
        return jsonify(processed_news), 200
    else:
        return jsonify({"error": "No news found"}), 404
    
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