# models.py contains the database models for the application.
from app import db
from uuid import uuid4
from datetime import datetime
# Users table. Contains all user information.

# Generates a unique identifier for each user
def get_uuid():
    return uuid4().hex

# User table. Contains all user information.
class User(db.Model):
    id = db.Column(db.String(32), primary_key=True, unique=True, default=get_uuid)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(128))
    budget = db.Column(db.Float)
    risk_tolerance_score = db.Column(db.Float)
    time_created = db.Column(db.DateTime, default=datetime.utcnow)
    def to_dict(self):
        return {
            'username' : self.username,
            'email': self.email,
            'budget': self.budget,
            'risk_tolerance_score': self.risk_tolerance_score
        }

    #relationships
    portfolio = db.relationship('Portfolio', backref='owner', uselist=False, cascade='all, delete-orphan')
    
    #Represent with the users username
    def __repr__(self):
        return f'<User {self.username}>'

# Portfolio table. Contains all portfolio information.
class Portfolio(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(32), db.ForeignKey('user.id'), unique=True)
    #relationshios
    stocks = db.relationship('Stock', backref='portfolio', lazy='dynamic', cascade='all, delete-orphan')
    #Represent with the users username
    def __repr__(self):
        return f'<Portfolio {self.id}>'
    
# Mster table for all stocks to be stored in
class StockMaster(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    symbol = db.Column(db.String(6), unique=True, index=True)  # Unique symbol
    price = db.Column(db.Float)
    company_overview = db.Column(db.JSON)
    global_quote = db.Column(db.JSON)
    time_series_monthly = db.Column(db.JSON)
    news_sentiment_data = db.Column(db.JSON)
    insider_volume = db.Column(db.Float) # We need a function to caclulate the net transaaction volume from INSIDER_TRANSACTIONS AV Endpoint
    # Update columns for API calls
    last_stock_update = db.Column(db.DateTime)
    last_in_depth_update = db.Column(db.DateTime)
    # In depth columns
    income_statement = db.Column(db.JSON)
    cash_flow_history = db.Column(db.JSON) # History for generating a bigger picture
    free_cash_flow = db.Column(db.Float) # immediate cash flow for comparison
    debt_to_equity = db.Column(db.Float)
    roic = db.Column(db.Float)
    price_to_fc = db.Column(db.Float)
    cashAndCashEquivalents = db.Column(db.Float)
    news = db.relationship('StockNews', backref='stock', uselist=False, cascade='all, delete-orphan') # One to one relationship with news table

    def __repr__(self):
        return f'<StockMaster {self.symbol}>'

    def to_dict(self):
        return {
            'symbol': self.symbol,
            'price': self.price or 0.0,
            'company_overview': self.company_overview,
            'global_quote': self.global_quote,
            'time_series_monthly': self.time_series_monthly,
            'news_sentiment_data': self.news_sentiment_data,
            'insider_volume': self.insider_volume,
            'last_stock_update': self.last_stock_update or None,
            'last_in_depth_update': self.last_in_depth_update or None,
            'income_statement': self.income_statement,
            'cash_flow_history': self.cash_flow_history,
            'free_cash_flow': self.free_cash_flow or 0.0,
            'debt_to_equity': self.debt_to_equity or 0.0,
            'roic': self.roic or 0.0,
            'price_to_fc': self.price_to_fc or 0.0,
            'cashAndCashEquivalents': self.cashAndCashEquivalents or 0.0
        }

# Stock table. A stock belongs to a portfolio and has its information stored in the stock master.
class Stock(db.Model):
    id = db.Column(db.Integer, primary_key=True)  
    portfolio_id = db.Column(db.Integer, db.ForeignKey('portfolio.id'))
    stock_master_id = db.Column(db.Integer, db.ForeignKey('stock_master.id'))
    stock_master = db.relationship('StockMaster')  # Relationship to the master stock table
    
    def __repr__(self):
        return f'<Stock {self.stock_master.symbol} in Portfolio {self.portfolio_id}>'

    def to_dict(self):
        stock_data = self.stock_master.to_dict()
        stock_data['notes'] = self.notes
        return stock_data

# Stock news table. Contains all news items for a specific stock.
class StockNews(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    stock_master_id = db.Column(db.Integer, db.ForeignKey('stock_master.id'), unique=True)
    news_summary = db.Column(db.String(5000))
    sentiment_positive = db.Column(db.Float)
    sentiment_neutral = db.Column(db.Float)
    sentiment_negative = db.Column(db.Float)
    last_news_update = db.Column(db.DateTime)

    def __repr__(self):
        return f'<StockNews {self.stock_master_id}>'
    
    def to_dict(self):
        return {
            'news_summary': self.news_summary or "No news summary available",
            'stock_sentiment': {
                'positive': self.sentiment_positive or 0.0,
                'neutral': self.sentiment_neutral or 0.0,
                'negative': self.sentiment_negative or 0.0
            }
        }

# News table. Contains all news items for the general stock news filter. Not used for individual stock news.
class GeneralStockNews(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filter_id = db.Column(db.Integer, db.ForeignKey('filter.id'))
    title = db.Column(db.String(500))
    image_link = db.Column(db.String(255))
    summary = db.Column(db.String(5000))
    link = db.Column(db.String(255))
    time_published = db.Column(db.DateTime)
    news_company = db.Column(db.String(255))
    bias_rating = db.Column(db.String(255))
    last_news_update = db.Column(db.DateTime)

    filter = db.relationship('Filter', backref='news_items', uselist=False)

    def __repr__(self):
        return f'<GeneralStockNews {self.title}>'
    
    def to_dict(self):
        return {
            'title': self.title,
            'summary': self.summary,
            'link': self.link,
            'time_published': self.time_published,
            'news_company': self.news_company,
            'image_link': self.image_link
        }

# Filter table. For assigning ids to filter names
class Filter(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filter_name = db.Column(db.String(255))
    
    def __repr__(self):
        return f'<Filter {self.filter_name}>'
    
    def to_dict(self):
        return {
            'filter_name': self.filter_name
        }

    
    
    