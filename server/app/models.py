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
    wishlist = db.relationship('Wishlist', backref='owner', uselist=False)
    #Represent with the users username
    def __repr__(self):
        return f'<User {self.username}>'
#IMPLEMENT THESE TABLES
class Portfolio(db.Model):
    pass
class Wishlist(db.Model):
    pass
class Stock(db.Model):
    pass
class PortfolioStock(db.Model):
    pass
class WishlistStock(db.Model):
    pass