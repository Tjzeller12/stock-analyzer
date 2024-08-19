import os
from dotenv import load_dotenv
# loads the enviorment variabls on the .env file
load_dotenv()

# Theis class holds configuration settings for the app
class Config:
    # set database Uniform Resource Identifier (URI) by trying to get the DATABASE_URL. If it is not found then
    # it uses default local PostgreSQL URI
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'postgresql://localhost/stock_analyzer_database'
    # Tracking modifications can be reasorce-intensive so we will turn it off
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # This set Redis URI. This works the same as the database URI
    # redis stores data in memory making read and write operations fast. It also supports many data structures and operations.
    REDIS_URL = os.environ.get('REDIS_URL') or 'redis://localhost:6379/0'