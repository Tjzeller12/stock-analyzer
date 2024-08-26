from flask import Blueprint, request, jsonify, session
from app.models import User, Portfolio
from app import bcrypt
from app import db
from app.routes import get_current_user
# Make auth blueprint
auth = Blueprint('auth', __name__)

# creates a new user and adds it to the database
def create_user(username, password_hash, email, longterm_investor = False):
    new_user = User(username=username, password_hash=password_hash, email=email, longterm_investor=longterm_investor)
    db.session.commit()
    session['user_id'] = new_user.id
    #initialize the users portfolio and wishlist
    portfolio = Portfolio(owner=new_user)
    #Add and commit the user, protfollio, and wishlist to the database
    db.session.add(new_user)
    db.session.add(portfolio)
    db.session.commit()


# attempt to register a new user
@auth.route('/register', methods=['POST'])
def register():
    # Attempt to get username, password, and email from request
    username = request.json["username"]
    password = request.json["password"]
    email = request.json["email"]
    longterm_investor = request.json["longterm_investor"]

    user_exists = User.query.filter_by(username=username).first() is not None

    if user_exists:
        return jsonify({"error": "Username already exists"}), 409

    if not username or not password or not email:
        return jsonify({"error": "Username, password, and email are required"}), 400

    # Generate password hash
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    # Create new user
    create_user(username=username, password_hash=password_hash, email=email, longterm_investor=longterm_investor)

    return jsonify({
        "username": username,
        "email": email,
        "longterm_investor": longterm_investor,
        "message":"User successfully created"}), 200

@auth.route('/@me')
def get_user():
    user = get_current_user()
    if user is None:
        return jsonify({"error": "User not logged in"}), 401

    return jsonify({
        "username": user.username,
        "email": user.email,
        "longterm_investor": user.longterm_investor,
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
        session['user_id'] = user.id
        return jsonify({"message": "Login successful"}), 201
    else:
        return jsonify({"error": "Invalid username or password"}), 401


