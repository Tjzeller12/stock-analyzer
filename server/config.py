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
        'postgresql://zeller:june1200@db/stock_analyzer_database'
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

    SESSION_COOKIE_SAMESITE = 'Strict'  # Set to 'Strict' or 'None' if required
    SESSION_COOKIE_SECURE = True  # Ensure this is True if using HTTPS