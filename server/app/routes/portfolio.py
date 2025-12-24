from flask import jsonify, Blueprint, request, current_app
from app import db, cache
from app.models import Stock, StockMaster
from sqlalchemy import desc
from app.routes.auth import get_current_user
from app.services.stock_manager import add_stock
from app.services.alpha_api import *


bp = Blueprint('portfolio', __name__)
# Removes a stock from the users portfolio
@bp.route('/remove', methods=['POST'])
def remove_stock():
    current_user = get_user()
    # Get the symbol from the request
    symbol = request.json.get("symbol")
    if not symbol:
        return jsonify({"error": "No symbol provided"}), 400
    # Get the portfolio from the user
    portfolio = current_user.portfolio
    if not portfolio:
        return jsonify({"error": "User does not have a portfolio"}), 400
    # Join Stock with StockMaster to filter by symbol
    try:
        # Join Stock with StockMaster to filter by symbol
        stock = ( Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id, StockMaster.symbol == symbol).first())

        if not stock:
            return jsonify({"error": f"Stock {symbol} not found in your portfolio."}), 404

        # Delete the stock from the user's portfolio
        db.session.delete(stock)
        db.session.commit()
        db.session.expire_all()
        return jsonify({"success": f"Stock {symbol} removed from your portfolio."}), 200

    except Exception as e:
        db.session.rollback()  # Rollback in case of error
        current_app.logger.error(f"Error removing stock: {e}")
        return jsonify({"error": "An error occurred while removing the stock."}), 500


# Searches for the stock and if it exist it adds it to the users portfolio.
@bp.route('/add', methods=['POST'])
def add_stock_to_portfolio():
    # Get user
    current_user = get_user()
    # Get symbol from request
    symbol = request.json.get("symbol")
    if not symbol:
        return jsonify({"error": "No symbol provided"}), 400
    # Get portfolio from user
    portfolio = current_user.portfolio
    if not portfolio:
        current_app.logger.info("User does not have a portfolio")
        return jsonify({"error": "User does not have a portfolio"}), 400
    # Add stock to portfolio
    result = add_stock(symbol, portfolio.id)
    # Determine the response based on the result
    if "error" in result:
        current_app.logger.error(f"Error adding stock: {result['error']}")
        return jsonify(result), 400
    # Log success
    current_app.logger.info(f"Successfully added stock: {symbol} to portfolio.")
    return jsonify(result), 200

    # Updates the stocks in the portfolio
@bp.route('/refresh', methods=['POST'])
@cache.memoize(timeout=900)
def update_stocks():
    # Get current user
    current_user = get_user()
    # Get portfolio from user
    portfolio = current_user.portfolio
    if not portfolio:
        current_app.logger.error(f"Portfolio with id {portfolio.id} not found")
        return jsonify({"error": "User does not have a portfolio"}), 400
    # Get stocks from portfolio
    stocks = ( Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id).all())
    # Update stocks
    for stock in stocks:
        # Get stock data from API
        symbol = stock.stock_master.symbol
        # Fetch updated data from API
        try:
            # Get stock data from API
            data = get_stock_data(symbol)
            # Get stock price from API
            price = get_stock_price(symbol)
            # Check if data is available
            if not data or price is None:
                current_app.logger.warning(f"Data unavailable for symbol: {symbol}")
                continue  # Skip this stock and proceed to the next

            # Update stock master
            db.session.commit()
            db.session.expire_all()
        except Exception as e:
            # Log error
            current_app.logger.error(f"Error updating stock {symbol}: {e}")
            continue  # Log the error and move to the next stock
    # Commit the changes
    db.session.commit()
    # Return success
    return jsonify({'message': 'The stock refresh was successful'}), 200

# Recieves a string that states what the user wants to sort the stocks by from the front end and sorts the users porfolio
@bp.route('/stocks', methods=['POST'])
def stock_sort_by():
    # Get sort by
    sort_by = request.json.get("sortBy")
    # Get current user
    current_user = get_user()
    
    portfolio = current_user.portfolio
    if not portfolio:
        return jsonify({"error": "User does not have a portfolio"}), 400
    # Sort stocks by
    try:
        # Check if the sort by is descending
        if sort_by[0] == '-':
            # Sort by descending
            stocks = Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id).order_by(desc(getattr(StockMaster, sort_by[1:]))).all()
        else:
            stocks = Stock.query.join(StockMaster).filter(Stock.portfolio_id == portfolio.id).order_by(getattr(StockMaster, sort_by)).all()
        print("Stocks returned.")
        # Return the stocks
        return jsonify([stock.stock_master.to_dict() for stock in stocks])
    # Return error if invalid sort field
    except AttributeError:
        # Return error if invalid sort field
        return jsonify({"error": f"Invalid sort field: {sort_by}"})
    except Exception as e:
        # Log error
        current_app.logger.error(f"Error fetching stocks: {e}")
        # Return error
        return jsonify({"error": "An error occurred while fetching stocks."})
    
    def get_user():
        # Get current user
        current_user = get_current_user()
        if not current_user:
            current_app.logger.info("User not logged in")
            return jsonify({"error": "User not logged in"}), 401
        return current_user