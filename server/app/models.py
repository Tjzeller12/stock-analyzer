from app import db
from datetime import datetime
# Users table. Contains all user information.
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(128))
    longterm_investor = db.Column(db.Boolean)
    portfolio_id = db.Column(db.Integer(64), foreign_key=True)
    time_created = db.Column(db.DateTime, default=datetime.utcnow)
    #Represent with the users username
    def __repr__(self):
        return f'<User {self.username}>'