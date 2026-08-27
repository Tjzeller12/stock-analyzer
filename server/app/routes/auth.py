# auth.py is a blueprint that handles user authentication. It contains routes for registering, logging in, and logging out users.
from flask import Blueprint, request, jsonify, current_app
from app.models import User, Portfolio
from app import bcrypt
from app import db
import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
import requests as http_requests

# Make auth blueprint
auth = Blueprint('auth', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        current_user = get_current_user()
        if current_user is None:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

def create_token(user_id):
    expiration = datetime.utcnow() + timedelta(hours=24)  # Token valid for 24 hours
    token = jwt.encode({'user_id': user_id, 'exp': expiration}, 
                       current_app.config['SECRET_KEY'], 
                       algorithm='HS256')
    return token

# creates a new user and adds it to the database
def create_user(username, email, password_hash=None):
    new_user = User(username=username, password_hash=password_hash, email=email)
    db.session.add(new_user)
    db.session.commit()
    portfolio = Portfolio(owner=new_user)
    db.session.add(portfolio)
    db.session.commit()


# attempt to register a new user
@auth.route('/register', methods=['POST'])
def register():
    # Attempt to get username, password, and email from request
    username = request.json["username"]
    password = request.json["password"]
    email = request.json["email"]

    user_exists = User.query.filter_by(username=username).first() is not None

    if user_exists:
        return jsonify({"error": "Username already exists"}), 409

    if not username or not password or not email:
        return jsonify({"error": "Username, password, and email are required"}), 400

    # Generate password hash
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    # Create new user
    create_user(username=username, password_hash=password_hash, email=email)
    user = User.query.filter_by(username=username).first()
    token = create_token(user.id)
    return jsonify({
        "username": username,
        "email": email,
        "token": token,
        "message":"User successfully created"}), 200

# Get current user
@auth.route('/@me')
def get_user():
    user = get_current_user()
    if user is None:
        return jsonify({"error": "User not logged in"}), 401

    return jsonify({
        "username": user.username,
        "email": user.email,
        "message": "User successfully retrieved"
    }), 200

# attempt to log user in using provided username and password
@auth.route('/login', methods=['POST'])
def login():
    # Attempt to get usernmae and password
    
    username = request.json["username"]
    password = request.json["password"]
    
    # find user in database by username
    user = User.query.filter_by(username=username).first()

    # use check_password_hash to convert the password to hash code and see if it matches the users hash code
    if user and bcrypt.check_password_hash(user.password_hash, password):
        token = create_token(user.id)
        current_app.logger.info(f"User {username} logged in successfully with token {token}")
        return jsonify({"message": "Login successful", "token": token}), 200
    else:
        return jsonify({"error": "Invalid username or password"}), 401

# Logout route
@auth.route('/logout', methods=['POST'])
def logout():
    return jsonify({"message": "Logout successful"}), 200


@auth.route('/google', methods=['POST'])
def google_login():
    """
    Exchange a Google ID token for our own JWT.

    Flow:
      1. Frontend signs in with Google and receives an ID token from Google.
      2. Frontend POSTs that token here.
      3. We verify it with Google's servers (catches fakes/replays).
      4. We find or create the user by email.
      5. We return our own JWT — the rest of the app is unchanged.
    """
    token = request.json.get("token")
    if not token:
        return jsonify({"error": "Google token is required"}), 400

    try:
        # Exchange the access token for the user's profile info.
        # Google's userinfo endpoint verifies the token and returns
        # the user's email, name, and unique Google ID ("sub").
        response = http_requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        response.raise_for_status()
        user_info = response.json()
    except Exception as e:
        return jsonify({"error": f"Failed to verify Google token: {str(e)}"}), 401

    email = user_info.get("email")
    google_id = user_info.get("sub")   # Google's permanent unique user ID
    name = user_info.get("name", "")

    if not email or not google_id:
        return jsonify({"error": "Google account missing email"}), 400

    # Find existing user by Google ID first, then fall back to email
    # (handles the case where someone registered with email/password before)
    user = User.query.filter_by(google_id=google_id).first()

    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            # Existing email/password user — link their Google account
            user.google_id = google_id
            db.session.commit()
        else:
            # Brand new user — create an account automatically
            base_username = name.replace(" ", "").lower() or email.split("@")[0]
            username = base_username
            counter = 1
            while User.query.filter_by(username=username).first():
                username = f"{base_username}{counter}"
                counter += 1

            user = User(username=username, email=email, google_id=google_id)
            db.session.add(user)
            db.session.commit()
            portfolio = Portfolio(owner=user)
            db.session.add(portfolio)
            db.session.commit()

    token = create_token(user.id)
    return jsonify({
        "token": token,
        "username": user.username,
        "email": user.email,
        "message": "Google login successful",
    }), 200

# Attemps to recieve user token from front-end. Quereys that user by ID and returns it.
def get_current_user():
    # Get the token from the Authorization header
    auth_header = request.headers.get('Authorization')
    if auth_header:
        token = auth_header.split(" ")[1]  # Bearer <token>
        try:
            # Decode the token to get the payload (which includes the user_id)
            decoded_token = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = decoded_token.get('user_id')
            
            # Query the user from the database using the extracted user_id
            user = User.query.filter_by(id=user_id).first()
            
            if user:
                print("User found")
                return user
            else:
                print("No user")
        except jwt.ExpiredSignatureError:
            print("Token expired")
            return None  # Handle expired token
        except jwt.InvalidTokenError:
            print("Token not found")
            return None  # Handle invalid token
    return None
