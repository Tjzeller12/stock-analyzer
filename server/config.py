import os
from dotenv import load_dotenv
load_dotenv()

# Theis class holds configuration settings for the app
class Config:
    # Secret key used to sign session cookies
    SECRET_KEY = os.environ['SECRET_KEY']
    # set database Uniform Resource Identifier (URI) by trying to get the DATABASE_URL. If it is not found then
    # it uses default local PostgreSQL URI
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'postgresql://localhost/stock_analyzer_database'
    # Tracking modifications can be reasorce-intensive so we will turn it off
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False  # Was True — logging every SQL query causes excessive memory buffering under load

    SESSION_TYPE = 'filesystem'
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = True

    SESSION_COOKIE_SAMESITE = 'Lax'  # Set to 'Lax' for development
    SESSION_COOKIE_SECURE = False  # Set to False for HTTP development

    # Frontend origin for CORS
    FRONTEND_ORIGIN = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:3000')
    # Optional alternate frontend origin for CORS
    FRONTEND_ORIGIN_ALT = os.environ.get('FRONTEND_ORIGIN_ALT')

    # --- Brokerage import (feature 10) ---
    # Which aggregator to use. SnapTrade ships first; 'plaid' is wired behind the
    # same provider interface for later.
    BROKERAGE_PROVIDER = os.environ.get('BROKERAGE_PROVIDER', 'snaptrade')

    # Fernet key used to encrypt brokerage tokens at rest (P2). Generate one with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    BROKERAGE_ENCRYPTION_KEY = os.environ.get('BROKERAGE_ENCRYPTION_KEY')

    # SnapTrade API credentials (https://snaptrade.com → dashboard).
    SNAPTRADE_CLIENT_ID = os.environ.get('SNAPTRADE_CLIENT_ID')
    SNAPTRADE_CONSUMER_KEY = os.environ.get('SNAPTRADE_CONSUMER_KEY')
    # Where SnapTrade's hosted Connection Portal redirects the user back to after
    # they finish linking their broker (a frontend route).
    SNAPTRADE_REDIRECT_URI = os.environ.get(
        'SNAPTRADE_REDIRECT_URI', f"{FRONTEND_ORIGIN}/main?connected=1"
    )

    # Plaid credentials (future; unused until PlaidProvider is implemented).
    PLAID_CLIENT_ID = os.environ.get('PLAID_CLIENT_ID')
    PLAID_SECRET = os.environ.get('PLAID_SECRET')
    PLAID_ENV = os.environ.get('PLAID_ENV', 'sandbox')