from flask import Blueprint, request, jsonify
from app.services.score_engine import calculate_single_stock_scores, calculate_compare_scores
from app.models import StockMaster
import logging

bp = Blueprint('radar', __name__)
logger = logging.getLogger(__name__)

@bp.route('/single', methods=['POST'])
def get_single_radar_scores():
    """
    Accepts a stock symbol and a RadarTemplate.
    Returns the 6 calculate scores for that individual stock using the predefined template scope (global/sector/industry).
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        symbol = data.get('symbol')
        template = data.get('template')

        is_relative = data.get('is_relative', False)

        if not symbol or not template:
            return jsonify({'error': 'Missing required fields: symbol and template'}), 400

        stock = StockMaster.query.filter_by(symbol=symbol).first()
        if not stock:
            return jsonify({'error': 'Stock not found'}), 404

        # Pass to the score engine
        scores = calculate_single_stock_scores(stock, template, is_relative)
        
        return jsonify({'scores': scores, 'symbol': symbol}), 200

    except Exception as e:
        logger.error(f'Error calculating single radar scores: {str(e)}')
        return jsonify({'error': 'Internal server error processing radar scores'}), 500

@bp.route('/compare', methods=['POST'])
def get_compare_radar_scores():
    """
    Accepts a list of stock symbols and a RadarTemplate.
    Returns a dictionary of the 6 calculated scores for each stock, normalized against each other.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        symbols = data.get('symbols')
        template = data.get('template')

        if not symbols or not isinstance(symbols, list) or len(symbols) == 0:
            return jsonify({'error': 'Missing or invalid required field: symbols (must be a non-empty list)'}), 400
        if not template:
            return jsonify({'error': 'Missing required field: template'}), 400

        # Query the database to get StockMaster objects for the provided symbols
        stocks = StockMaster.query.filter(StockMaster.symbol.in_(symbols)).all()
        
        if not stocks:
            return jsonify({'error': 'No valid stocks found for the provided symbols'}), 404

        # Pass the StockMaster objects to the score engine
        scores_by_symbol = calculate_compare_scores(stocks, template)
        
        return jsonify({'scores': scores_by_symbol}), 200

    except Exception as e:
        logger.error(f'Error calculating compare radar scores: {str(e)}')
        return jsonify({'error': 'Internal server error processing compare radar scores'}), 500
