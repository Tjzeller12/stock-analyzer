import sys
print(f"Python version: {sys.version}")
print(f"Python path: {sys.executable}")

try:
    import flask
    print(f"Flask version: {flask.__version__}")
except ImportError as e:
    print(f"Failed to import Flask: {e}")

try:
    import flask_cors
    print(f"Flask-CORS version: {flask_cors.__version__}")
except ImportError as e:
    print(f"Failed to import Flask-CORS: {e}")

try:
    import dotenv
    print(f"python-dotenv is installed")
except ImportError as e:
    print(f"Failed to import python-dotenv: {e}")

try:
    from flask import Flask, jsonify
    from flask_cors import CORS
    from dotenv import load_dotenv

    load_dotenv()

    app = Flask(__name__)
    CORS(app)

    @app.route('/api/hello', methods=['GET'])
    def hello_world():
        return jsonify({"message": "Hello from Flask!"})

    if __name__ == '__main__':
        app.run(debug=True)
except Exception as e:
    print(f"Error setting up the Flask app: {e}")