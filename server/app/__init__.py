#__init__.py is the file that initializes the Flask app and all the extensions we will use in the app.
from flask import Flask, request, jsonify, session
from flask_caching import Cache
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_session import Session
from flask_migrate import Migrate
from flask_cors import CORS
from config import Config
import logging

# create instances of SQLAlchemy, Migrate
db = SQLAlchemy()
bcrypt = Bcrypt()
migrate = Migrate()
server_session = Session()
cache = Cache()

# Creates a new flask app and uses config.py to configure it
def create_app(config_class=Config):  
    app = Flask(__name__)
    app.config.from_object(config_class)
    # initisalize db, migrate, radius_client, CORS, and Bcrypt
    db.init_app(app)
    bcrypt.init_app(app)
    server_session.init_app(app)
    
    with app.app_context():
        # Import routes and models AFTER db is initialized
        from . import routes, models
        db.create_all()  # Create database tables for all models
    
    migrate.init_app(app, db)
    # Allow frontend origin from config
    CORS(app, resources={r"/*": {"origins": app.config.get('FRONTEND_ORIGIN')}})

    cache.init_app(app, config={'CACHE_TYPE': 'simple'})

    #simple test route
    @app.route('/api/test', methods=['GET'])
    def test():
        app.logger.info("Received a GET request on /api/test")
        return jsonify({"message": "Test successful!"})

    #import blue print to organize routes
    from app.routes.auth import auth as auth_blueprint
    app.register_blueprint(auth_blueprint, url_prefix='/auth')

    from app.routes.portfolio import bp as portfolio_bp
    app.register_blueprint(portfolio_bp, url_prefix='/portfolio')

    from app.routes.stock_data import bp as stock_data_bp
    app.register_blueprint(stock_data_bp, url_prefix='/data')

    from app.routes.profile import bp as profile_bp
    app.register_blueprint(profile_bp, url_prefix='/profile')

    from app.routes.main import bp as main_bp
    app.register_blueprint(main_bp)

    from app.alphaBot import alphaBot_bp
    app.register_blueprint(alphaBot_bp)

    app.debug = True
    #Return fully configured app
    return app

# detect db models. At bottom of file to prevent circular import
from app import models 


