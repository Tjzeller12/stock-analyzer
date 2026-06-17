from flask import Blueprint, request, jsonify, current_app
from app.routes.auth import get_current_user
from app.models import User, InvestorProfile
from app.services.profile_mapper import (
    map_answers_to_profile,
    merge_onboarding_payload,
    validate_onboarding_payload,
    persist_investor_profile,
)
from app.services.personalization import suggest_default_template
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
    if "username" in request.json:
        current_user.username = request.json["username"] 
    db.session.commit()
    return jsonify("Successfully saved new user information"), 200


@bp.route('/investor', methods=['GET'])
def get_investor_profile():
    """Return the current user's InvestorProfile, or a completed=False shell when
    they have not finished onboarding. Also includes a suggested radar template
    derived from the profile (opt-in, never auto-applied)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "User not logged in"}), 401

    profile = current_user.investor_profile or InvestorProfile.empty_for(current_user)
    body = profile.to_dict()
    body["suggested_template"] = suggest_default_template(profile)
    return jsonify(body), 200


@bp.route('/investor', methods=['PUT'])
def upsert_investor_profile():
    """Validate onboarding answers and persist atomically. Supports partial
    updates: any field omitted from the body preserves the user's existing value,
    so a user can update just one field (e.g. sectors) without re-answering the
    questionnaire. Idempotent upsert keyed on the user (P1)."""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"error": "User not logged in"}), 401

    payload = request.get_json(silent=True) or {}
    # Validate the incoming fields first (rejects malformed/over-length sector
    # lists or unknown keys).
    ok, err = validate_onboarding_payload(payload)
    if not ok:
        return jsonify({"error": err}), 400

    # Layer the incoming fields over the existing profile, then map.
    effective = merge_onboarding_payload(payload, current_user.investor_profile)
    result = map_answers_to_profile(effective)
    persist_investor_profile(current_user, result)

    body = current_user.investor_profile.to_dict()
    body["suggested_template"] = suggest_default_template(current_user.investor_profile)
    return jsonify(body), 200

    