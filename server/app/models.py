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
    username = db.Column(db.String(64), index=True, unique=True, nullable=True)
    email = db.Column(db.String(120), index=True, unique=True)
    password_hash = db.Column(db.String(128), nullable=True)
    google_id = db.Column(db.String(128), unique=True, nullable=True)
    budget = db.Column(db.Float)
    risk_tolerance_score = db.Column(db.Float)
    time_created = db.Column(db.DateTime, default=datetime.utcnow)
    tier = db.Column(db.String(20), nullable=False, default='free')
    alphabot_daily_uses = db.Column(db.Integer, default=0, nullable=False)
    alphabot_last_use_date = db.Column(db.Date, nullable=True)
    def to_dict(self):
        return {
            'username' : self.username,
            'email': self.email,
            'budget': self.budget,
            'risk_tolerance_score': self.risk_tolerance_score
        }

    #relationships
    portfolio = db.relationship('Portfolio', backref='owner', uselist=False, cascade='all, delete-orphan')
    investor_profile = db.relationship('InvestorProfile', backref='user', uselist=False, cascade='all, delete-orphan')

    #Represent with the users username
    def __repr__(self):
        return f'<User {self.username}>'


# Investor profile table. 1:1 with User. Source of truth for the onboarding-derived
# personalization data (risk, horizon, budget, preferred sectors). The two scalar columns
# on User (budget, risk_tolerance_score) are kept denormalized and synced from here.
class InvestorProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(32), db.ForeignKey('user.id'), unique=True, nullable=False)

    # --- Deterministic derived values ---
    risk_tolerance_score = db.Column(db.Float, default=50.0)   # 0-100
    risk_tag = db.Column(db.String(20))                        # Conservative..Aggressive
    time_horizon_years = db.Column(db.Integer)                 # raw answer, e.g. 12
    horizon_tag = db.Column(db.String(20))                     # Short..Very Long

    # --- Direct inputs ---
    budget = db.Column(db.Float, default=0.0)                  # denormalized to User.budget
    preferred_sectors = db.Column(db.JSON, default=list)       # <= 3 canonical sector keys

    # --- Audit / resume ---
    raw_answers = db.Column(db.JSON, default=dict)             # {questionId: optionId}
    onboarding_completed = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<InvestorProfile user={self.user_id} risk={self.risk_tag}>'

    @classmethod
    def empty_for(cls, user):
        """Return a transient (unsaved) completed=False shell profile for a user
        who has not finished onboarding. Never added to the session."""
        return cls(
            user_id=user.id,
            risk_tolerance_score=50.0,
            risk_tag=None,
            time_horizon_years=None,
            horizon_tag=None,
            budget=user.budget or 0.0,
            preferred_sectors=[],
            raw_answers={},
            onboarding_completed=False,
            updated_at=None,
        )

    def to_dict(self):
        return {
            'risk_tolerance_score': self.risk_tolerance_score,
            'risk_tag': self.risk_tag,
            'time_horizon_years': self.time_horizon_years,
            'horizon_tag': self.horizon_tag,
            'budget': self.budget,
            'preferred_sectors': self.preferred_sectors or [],
            'onboarding_completed': self.onboarding_completed,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

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

    # --- Metadata & Identifiers ---
    symbol = db.Column(db.String(6), unique=True, index=True, nullable=False)
    name = db.Column(db.String(255))
    sector = db.Column(db.String(100))
    industry = db.Column(db.String(100))
    description = db.Column(db.Text)
    
    # --- Price Action (Global Quote) ---
    price = db.Column(db.Float)
    price_change_percent = db.Column(db.Float)
    volume = db.Column(db.BigInteger)
    
    # --- Valuation Metrics (Overview API) ---
    market_cap = db.Column(db.BigInteger)
    pe_ratio = db.Column(db.Float)
    forward_pe = db.Column(db.Float)
    peg_ratio = db.Column(db.Float)
    ev_to_ebitda = db.Column(db.Float)
    price_to_sales = db.Column(db.Float)        
    price_to_book = db.Column(db.Float)
    price_to_fc = db.Column(db.Float)           
    dividend_yield = db.Column(db.Float)
    
    # --- Profitability & Efficiency ---
    roe = db.Column(db.Float)                   
    roa = db.Column(db.Float)                   
    operating_margin = db.Column(db.Float)      
    profit_margin = db.Column(db.Float)         
    roic = db.Column(db.Float)                  
    
    # --- Growth Metrics (QoQ/YoY) ---
    rev_growth_qoq = db.Column(db.Float)        
    eps_growth_qoq = db.Column(db.Float)        
    
    # --- Financial Health (Consolidated) ---
    operating_cash_flow = db.Column(db.Float)
    capital_expenditures = db.Column(db.Float)
    free_cash_flow = db.Column(db.Float)
    total_assets = db.Column(db.BigInteger)
    total_liabilities = db.Column(db.BigInteger)
    total_shareholder_equity = db.Column(db.BigInteger)
    net_income = db.Column(db.BigInteger)
    cash_and_equiv = db.Column(db.Float)        
    debt_to_equity = db.Column(db.Float)
    
    # --- Risk & Sentiment ---
    beta = db.Column(db.Float)
    buy_ratings_count = db.Column(db.Integer)   
    hold_ratings_count = db.Column(db.Integer)  
    sell_ratings_count = db.Column(db.Integer)  
    insider_volume = db.Column(db.Float)        
    
    # --- Analyst Ratings Breakdown ---
    analyst_strong_buy = db.Column(db.Integer, default=0)
    analyst_buy = db.Column(db.Integer, default=0)
    analyst_hold = db.Column(db.Integer, default=0)
    analyst_sell = db.Column(db.Integer, default=0)
    analyst_strong_sell = db.Column(db.Integer, default=0)
    
    # --- AI Insights ---
    ai_news_score = db.Column(db.Float)         
    ai_news_summary = db.Column(db.Text)
    ai_moat_score = db.Column(db.Float)         
    ai_moat_summary = db.Column(db.Text)
    
    # --- Update Tracking ---
    last_stock_update = db.Column(db.DateTime)      
    last_fundamental_update = db.Column(db.DateTime) 
    
    # --- Raw Data Blobs ---
    income_statement_history = db.Column(db.JSON) 
    cash_flow_history = db.Column(db.JSON)
    news_sentiment_data = db.Column(db.JSON)

    # --- Relationships ---
    news = db.relationship('StockNews', backref='stock', uselist=False, cascade='all, delete-orphan') # One to one relationship with news table

    def __repr__(self):
        return f'<StockMaster {self.symbol}>'

    def to_dict(self):
        return {
            'symbol': self.symbol,
            'name': self.name,
            'sector': self.sector,
            'industry': self.industry,
            'description': self.description,
            'price': self.price or 0.0,
            'price_change_percent': self.price_change_percent,
            'volume': self.volume,
            'market_cap': self.market_cap,
            'pe_ratio': self.pe_ratio,
            'forward_pe': self.forward_pe,
            'peg_ratio': self.peg_ratio,
            'ev_to_ebitda': self.ev_to_ebitda,
            'price_to_sales': self.price_to_sales,
            'price_to_book': self.price_to_book,
            'price_to_fc': self.price_to_fc,
            'dividend_yield': self.dividend_yield,
            'roe': self.roe,
            'roa': self.roa,
            'operating_margin': self.operating_margin,
            'profit_margin': self.profit_margin,
            'roic': self.roic,
            'rev_growth_qoq': self.rev_growth_qoq,
            'eps_growth_qoq': self.eps_growth_qoq,
            'debt_to_equity': self.debt_to_equity,
            'free_cash_flow': self.free_cash_flow,
            'operating_cash_flow': self.operating_cash_flow,
            'capital_expenditures': self.capital_expenditures,
            'total_assets': self.total_assets,
            'total_liabilities': self.total_liabilities,
            'total_shareholder_equity': self.total_shareholder_equity,
            'net_income': self.net_income,
            'cashAndCashEquivalents': self.cash_and_equiv,
            'beta': self.beta,
            'buy_ratings_count': self.buy_ratings_count,
            'hold_ratings_count': self.hold_ratings_count,
            'sell_ratings_count': self.sell_ratings_count,
            'analyst_strong_buy': self.analyst_strong_buy,
            'analyst_buy': self.analyst_buy,
            'analyst_hold': self.analyst_hold,
            'analyst_sell': self.analyst_sell,
            'analyst_strong_sell': self.analyst_strong_sell,
            'insider_volume': self.insider_volume,
            'ai_news_score': self.ai_news_score,
            'ai_news_summary': self.ai_news_summary,
            'ai_moat_score': self.ai_moat_score,
            'ai_moat_summary': self.ai_moat_summary,
            'last_stock_update': self.last_stock_update.isoformat() if self.last_stock_update else None,
            'last_fundamental_update': self.last_fundamental_update.isoformat() if self.last_fundamental_update else None,
            'news_sentiment_data': self.news_sentiment_data,
            'income_statement': self.income_statement_history,
            'cash_flow_history': self.cash_flow_history
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
    image_link = db.Column(db.Text)
    summary = db.Column(db.Text)
    link = db.Column(db.Text)
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

class MarketStats(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    scope_type = db.Column(db.String(50), nullable=False) # e.g., "global", "sector", "industry"
    scope_name = db.Column(db.String(100), nullable=False) # e.g., "All", "Technology", "Software - Infrstructure"
    stats_data = db.Column(db.JSON, nullable=False, default=dict)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<MarketStats {self.scope_type}:{self.scope_name}>'

    def to_dict(self):
        return {
            'scope_type': self.scope_type,
            'scope_name': self.scope_name,
            'stats_data': self.stats_data,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }

class AnalysisTemplate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255))
    creator_id = db.Column(db.String(32), db.ForeignKey('user.id'), nullable=True) # Null for default templates
    
    # Store equations as a JSON object
    # Example:
    # {
    #   "Valuation": "(n_pe_ratio * 0.4) + (n_ev_to_ebitda * 0.4) + (n_price_to_fc * 0.2)",
    #   ...
    # }
    equations = db.Column(db.JSON, nullable=False)
    
    is_default = db.Column(db.Boolean, default=False)
    time_created = db.Column(db.DateTime, default=datetime.utcnow)
    def __repr__(self):
        return f'<AnalysisTemplate {self.name}>'
        
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'equations': self.equations,
            'is_default': self.is_default
        }
    
    