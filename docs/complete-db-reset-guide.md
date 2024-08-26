# Complete Database Reset Guide

1. Stop your Flask application if it's running.

2. Connect to PostgreSQL as a superuser:
   ```
   psql postgres
   ```

3. Drop the existing database and recreate it:
   ```sql
   DROP DATABASE IF EXISTS stock_analyzer_database;
   CREATE DATABASE stock_analyzer_database;
   ```

4. Grant privileges to your user (replace 'tjzeller12' with your actual username):
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE stock_analyzer_database TO tjzeller12;
   ```

5. Connect to the new database:
   ```sql
   \c stock_analyzer_database
   ```

6. Grant schema privileges:
   ```sql
   GRANT ALL PRIVILEGES ON SCHEMA public TO tjzeller12;
   ```

7. Exit psql:
   ```
   \q
   ```

8. Delete the migrations folder in your project directory:
   ```
   rm -rf migrations
   ```

9. Initialize a new migration repository:
   ```
   flask db init
   ```

10. Create a new migration:
    ```
    flask db migrate -m "initial migration"
    ```

11. Apply the migration:
    ```
    flask db upgrade
    ```

12. Verify the tables were created:
    ```
    psql stock_analyzer_database
    \dt
    ```

If you see your tables listed, the reset was successful. You can now exit psql with `\q`.
