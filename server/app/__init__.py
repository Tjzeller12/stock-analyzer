from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_redis import FlaskRedis
from flask_cors import CORS
from config import Config

db = SQLAlchemy()
migrate = Migrate()
redis_client = FlaskRedis()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    redis_client.init_app(app)
    CORS(app)

    from app.routes import bp as main_bp
    app.register_blueprint(main_bp)

    return app

from app import models