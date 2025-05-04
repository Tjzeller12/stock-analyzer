import os
from flask import Flask
from app.models import db
from sqlalchemy import text
from app.services.news_manager import seed_filters

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
    db.init_app(app)
    return app

def reset_db():
    app = create_app()
    with app.app_context():
        # Drop all tables with CASCADE
        db.session.execute(text('DROP SCHEMA public CASCADE;'))
        db.session.execute(text('CREATE SCHEMA public;'))
        db.session.commit()
        print("All tables dropped.")

        # Create all tables
        db.create_all()
        print("All tables recreated.")

        # Seed the filters
        seed_filters()
        print("Filters seeded.")

if __name__ == "__main__":
    reset_db()
