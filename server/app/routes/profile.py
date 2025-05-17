from flask import Blueprint, request, jsonify, current_app
from app.routes.auth import get_current_user
from app.models import User
from app import bcrypt
from app import db

# Make auth blueprint
bp = Blueprint('profile', __name__)

@bp.route('/info', methods=['POST'])
def get_user_info() :
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    return jsonify(current_user.to_dict()), 200

@bp.route('/reset', methods=['POST'])
def reset_password():
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    new_password = request.json["newPassword"]
    if not new_password:
        return jsonify({"error": "Password not recieved"}), 401
    current_user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.session.commit()
    return jsonify({"message" : "Successfully reset password"}), 200


@bp.route('/save', methods=['POST'])
def save():
    current_user = get_current_user()
    if not current_user:
        current_app.logger.info("User not logged in")
        return jsonify({"error": "User not logged in"}), 401
    current_user.longterm_investor = request.json["longterm_investor"]
    current_user.username = request.json["username"] 
    db.session.commit()
    return jsonify("Successfully saved new user information"), 200

    