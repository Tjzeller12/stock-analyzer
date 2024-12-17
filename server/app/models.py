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
    longterm_investor = db.Column(db.Boolean)
    time_created = db.Column(db.DateTime, default=datetime.utcnow)

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
    name = db.Column(db.String(50))
    industry = db.Column(db.String(50))
    ev_to_ebita = db.Column(db.Float)
    pe_ratio = db.Column(db.Float)
    price = db.Column(db.Float)
    market_cap = db.Column(db.Float)
    dividend_yield = db.Column(db.Float)
    buy_rating = db.Column(db.Float)
    hold_rating = db.Column(db.Float)
    sell_rating = db.Column(db.Float)

    def __repr__(self):
        return f'<StockMaster {self.symbol}>'

    def to_dict(self):
        return {
            'symbol': self.symbol,
            'name': self.name,
            'industry': self.industry,
            'ev_to_ebita': self.ev_to_ebita or 0.0,
            'pe_ratio': self.pe_ratio or 0.0,
            'price': self.price or 0.0,
            'market_cap': self.market_cap or 0.0,
            'dividend_yield': self.dividend_yield or 0.0,
            'buy_rating': self.buy_rating or 0.0,
            'hold_rating': self.hold_rating or 0.0,
            'sell_rating': self.sell_rating or 0.0,
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