"""
brokerage.py — read-only brokerage import routes (feature 10).

  POST /brokerage/connect/start     → aggregator hosted-flow redirect URI
  POST /brokerage/connect/callback  → finalize connection + first sync
  POST /brokerage/sync              → re-pull holdings (idempotent)
  GET  /brokerage/holdings          → holdings + performance + last_synced
  POST /brokerage/disconnect        → purge credentials (+ holdings per choice)
  POST /brokerage/publish           → opt-in community performance (verified only)

All routes require auth. Tokens are never serialized into any response (P2).
"""
from flask import Blueprint, jsonify, request, current_app

from app.routes.auth import get_current_user
from app.services import brokerage_service

brokerage_bp = Blueprint("brokerage", __name__)


def _require_user():
    user = get_current_user()
    if user is None:
        return None, (jsonify({"error": "User not logged in"}), 401)
    return user, None


@brokerage_bp.route("/brokerage/connect/start", methods=["POST"])
def connect_start():
    user, err = _require_user()
    if err:
        return err
    try:
        result = brokerage_service.start_connection(user)
        return jsonify(result), 200
    except Exception as e:
        current_app.logger.error(f"Brokerage connect/start failed: {e}")
        return jsonify({"error": "Could not start brokerage connection"}), 502


@brokerage_bp.route("/brokerage/connect/callback", methods=["POST"])
def connect_callback():
    user, err = _require_user()
    if err:
        return err
    try:
        result, status = brokerage_service.complete_connection(user)
        return jsonify(result), status
    except Exception as e:
        current_app.logger.error(f"Brokerage connect/callback failed: {e}")
        return jsonify({"error": "Could not finalize brokerage connection"}), 502


@brokerage_bp.route("/brokerage/sync", methods=["POST"])
def sync():
    user, err = _require_user()
    if err:
        return err
    # Include "pending": the SnapTrade hosted portal redirects straight to the
    # frontend, so the connect/callback that would flip pending→active never runs.
    # sync_holdings promotes a pending connection to active on the first good pull.
    connections = [c for c in user.brokerage_connections if c.status in ("active", "pending")]
    if not connections:
        return jsonify({"error": "No active brokerage connection"}), 404
    try:
        for connection in connections:
            brokerage_service.sync_holdings(connection)
        brokerage_service.compute_performance(user)
        return jsonify(brokerage_service.get_holdings_view(user)), 200
    except Exception as e:
        current_app.logger.error(f"Brokerage sync failed: {e}")
        return jsonify({"error": "Sync failed"}), 502


@brokerage_bp.route("/brokerage/holdings", methods=["GET"])
def holdings():
    user, err = _require_user()
    if err:
        return err
    return jsonify(brokerage_service.get_holdings_view(user)), 200


@brokerage_bp.route("/brokerage/disconnect", methods=["POST"])
def disconnect():
    user, err = _require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    purge_holdings = bool(body.get("purge_holdings", True))
    connections = [c for c in user.brokerage_connections if c.status in ("active", "pending", "error")]
    if not connections:
        return jsonify({"error": "No brokerage connection to disconnect"}), 404
    for connection in connections:
        brokerage_service.disconnect(connection, purge_holdings=purge_holdings)
    return jsonify({"disconnected": True}), 200


@brokerage_bp.route("/brokerage/publish", methods=["POST"])
def publish():
    user, err = _require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    template_id = body.get("template_id")
    anonymize = bool(body.get("anonymize", True))
    result, status = brokerage_service.publish_performance(
        user, template_id=template_id, anonymize=anonymize
    )
    return jsonify(result), status
