from app import db
from datetime import datetime
# Users table. Contains all user information.
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(128))
    longterm_investor = db.Column(db.Boolean)
    time_created = db.Column(db.DateTime, default=datetime.utcnow)

    #relationships
    portfolio = db.relationship('Portfolio', backref='owner', uselist=False)
    
    #Represent with the users username
    def __repr__(self):
        return f'<User {self.username}>'
#IMPLEMENT THESE TABLES
class Portfolio(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    anual_return = db.Column(db.Float)
    total_return = db.Column(db.Float)
    total_investment = db.Column(db.Float)
    total_withdrawal = db.Column(db.Float)
    #relationshios
    stocks = db.relationship('PortfolioStock', backref='portfolio', lazy='dynamic')
    #Represent with the users username
    def __repr__(self):
        return f'<Portfolio {self.id}>'
    

class Stock(db.Model):
    id = db.Column(db.Integer, primary_key=True)  
    symbol = db.Column(db.String(4), index=True, unique=True)
    weekly_high = db.Column(db.Float)
    weekly_low = db.Column(db.Float)
    weekly_open = db.Column(db.Float)
    weekly_close = db.Column(db.Float)
    


class PortfolioStock(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    portfolio_id = db.Column(db.Integer, db.ForeignKey('portfolio.id'))
    stock_id = db.Column(db.Integer, db.ForeignKey('stock.id'))
    quantity = db.Column(db.Integer)
    purchase_price = db.Column(db.Float)
    purchase_date = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<PortfolioStock {self.id}>'
