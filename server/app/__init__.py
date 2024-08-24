from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from flask_redis import FlaskRedis
from flask_cors import CORS
from config import Config
import logging




# create instances of SQLAlchemy, Migrate, and FlaskRedis
db = SQLAlchemy()
bcrypt = Bcrypt()
migrate = Migrate()
redis_client = FlaskRedis()
from app.models import User, Portfolio, Stock

# Creates a new flask app and uses config.py to configure it
def create_app(config_class=Config):  
    app = Flask(__name__)
    app.config.from_object(config_class)
    # initisalize db, migrate, radius_client, CORS, and Bcrypt
    db.init_app(app)
    bcrypt.init_app(app)
    with app.app_context():
        # Import routes and models
        from . import routes, models
        db.create_all()  # Create database tables for all models
    migrate.init_app(app, db)
    redis_client.init_app(app)
    CORS(app)
    CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

    #simple test route
    @app.route('/api/test', methods=['GET'])
    def test():
        app.logger.info("Received a GET request on /api/test")
        return jsonify({"message": "Test successful!"})

    #import blue print to organize routes
    from app.auth import auth as auth_blueprint
    app.register_blueprint(auth_blueprint, url_prefix='/auth')

    from app.routes import bp as main_bp
    app.register_blueprint(main_bp)

    app.debug = True
    #Return fully configured app
    return app
# detect db models. At bottom of file to prevent circular import
from app import models 

