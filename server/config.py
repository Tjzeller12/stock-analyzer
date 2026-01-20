import os
from dotenv import load_dotenv
import redis
# loads the enviorment variabls on the .env file
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
    SQLALCHEMY_ECHO = True

    # This set Redis URI. This works the same as the database URI
    # redis stores data in memory making read and write operations fast. It also supports many data structures and operations.
    REDIS_URL = os.environ['REDIS_URL'] or 'redis://localhost:6379/0'
    SESSION_TYPE = 'redis'
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = True
    SESSION_REDIS = redis.from_url(REDIS_URL)

    SESSION_COOKIE_SAMESITE = 'Lax'  # Set to 'Lax' for development
    SESSION_COOKIE_SECURE = False  # Set to False for HTTP development

    # Frontend origin for CORS
    FRONTEND_ORIGIN = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:3000')
    # Optional alternate frontend origin for CORS
    FRONTEND_ORIGIN_ALT = os.environ.get('FRONTEND_ORIGIN_ALT')