from app import db
from uuid import uuid4
from datetime import datetime
# Users table. Contains all user information.

def get_uuid():
    return uuid4().hex

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

class Portfolio(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(32), db.ForeignKey('user.id'), unique=True)
    #relationshios
    stocks = db.relationship('Stock', backref='portfolio', lazy='dynamic', cascade='all, delete-orphan')
    #Represent with the users username
    def __repr__(self):
        return f'<Portfolio {self.id}>'
    

class Stock(db.Model):
    id = db.Column(db.Integer, primary_key=True)  
    portfolio_id = db.Column(db.Integer, db.ForeignKey('portfolio.id'))
    symbol = db.Column(db.String(4), index=True, unique=True)
    name = db.Column(db.String(50))
    industry = db.Column(db.String(50))
    ev_to_ebita = db.Column(db.Float)
    pe_ratio = db.Column(db.Float)
    price = db.Column(db.Float)
    market_cap = db.Column(db.Float)
    buy_rating = db.Column(db.Float)
    hold_rating = db.Column(db.Float)
    sell_rating = db.Column(db.Float)
    dividend_yield = db.Column(db.Float)
    
    def __repr__(self):
        return f'<Stock {self.symbol}>'