from flask import Blueprint, request, jsonify
from models import User, Portfolio, Wishlist
from app import db, bcrypt

# Make auth blueprint
auth = Blueprint('auth', __name__)

# creates a new user and adds it to the database
def create_user(username, password_hash, email, lt_investor = False):
    new_user = User(username=username, password_hash=password_hash, email=email, longterm_investor=lt_investor)
    #initialize the users portfolio and wishlist
    portfolio = Portfolio(owner=new_user)
    wishlist = Wishlist(owner=new_user)
    #Add and commit the user, protfollio, and wishlist to the database
    db.session.add(new_user)
    db.session.add(portfolio)
    db.session.add(wishlist)
    db.session.commit()


# attempt to register a new user
@auth.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    lt_investor = data.get('longterm_investor')

    if not username or not password or not email:
        return jsonify({"error": "Username, password, and email are required"}), 400

    # Generate password hash
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    # Create new user
    create_user(username=username, password_hash=password_hash, email=email, lt_investor=lt_investor)

    return jsonify({"message":"User successfully created"}), 200


# attempt to log user in using provided username and password
@auth.route('/login', methods=['POST'])
def login():
    # Attempt to get usernmae and password
    data = requests.get_json()
    username = data.get('username')
    password = data.get('password')
    
    # find user in database by username
    user = User.query.filter_by(username=username).first()

    # use check_password_hash to convert the password to hash code and see if it matches the users hash code
    if user and bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({"message": "Login successful"}), 201
    else:
        return jsonify({"error": "Invalid username or password"}), 400


