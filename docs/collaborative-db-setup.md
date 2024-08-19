# Collaborative Database Setup Guide

## 1. Individual Local Databases

During development, it's recommended that each developer has their own local database. Here's how to set this up:

1. Each developer installs PostgreSQL on their machine.
2. Create a new database:
   ```
   createdb stock_analyzer_database
   ```
3. Update the `config.py` file to use environment variables:
   ```python
   import os
   from dotenv import load_dotenv

   load_dotenv()

   class Config:
       SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
           'postgresql://localhost/stock_analyzer_database'
       # ... other configurations ...
   ```
4. Create a `.env` file (and add it to .gitignore):
   ```
   DATABASE_URL=postgresql://username:password@localhost/stock_analyzer_database
   ```
5. Each developer sets their own username and password in the .env file.

## 2. Sharing Schema and Initial Data

To ensure database schemas are consistent:

1. Use Flask-Migrate to manage database migrations.
2. Commit migration files to your version control system.
3. Each developer runs migrations on their local database:
   ```
   flask db upgrade
   ```

For sharing initial data, create a script that inserts necessary data, and run it after migrations.

## 3. Syncing Production Data (Optional)

If needed, periodically sync production data to development environments:

1. Create a sanitized dump of the production database (removing sensitive data).
2. Share this dump file with the team.
3. Developers can then restore this data to their local databases.

Remember to never use real user data in development environments without proper anonymization.
