import logging
from app import create_app, db
from app.models import User, Portfolio, Stock, StockMaster, StockNews, GeneralStockNews, Filter  # Import ALL your model classes explicitly (add any missing ones)

# Create and configure flask app
app = create_app()
logging.basicConfig(level=logging.DEBUG)

from app.services.news_manager import seed_filters

#Check if program is being ran directly
with app.app_context():
    db.create_all()
    seed_filters()
    
if __name__ == '__main__':
    #Starts flask development server and enables debug mode
    app.run(debug=True, host='0.0.0.0', port=5000)
