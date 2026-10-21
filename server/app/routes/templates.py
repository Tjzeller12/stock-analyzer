"""
Private analysis templates: four seeded defaults + unlimited user-owned saves.

No community/share/stars. Defaults are immutable; edit means clone.
"""
from copy import deepcopy

from flask import Blueprint, jsonify, request

from app import db
from app.models import AnalysisTemplate
from app.routes.auth import get_current_user, login_required
from app.services.template_seed import ALLOWED_COLUMN_IDS, seed_default_templates

templates_bp = Blueprint("templates", __name__)

MIN_AXES = 3
MAX_AXES = 8
VALID_SCOPE = {"global", "sector", "industry"}


def validate_template_config(config):
    if not isinstance(config, dict):
        return False, "config is required"
    radar = config.get("radar")
    if not isinstance(radar, dict):
        return False, "config.radar is required"
    equations = radar.get("equations")
    if not isinstance(equations, dict) or not equations:
        return False, "config.radar.equations is required"
    if not (MIN_AXES <= len(equations) <= MAX_AXES):
        return False, f"radar must have {MIN_AXES}–{MAX_AXES} active axes"
    for name, formula in equations.items():
        if not isinstance(name, str) or not name.strip():
            return False, "axis names must be non-empty strings"
        if not isinstance(formula, str) or not formula.strip():
            return False, f"equation for {name!r} must be a non-empty string"
    scope = radar.get("scope", "global")
    if scope not in VALID_SCOPE:
        return False, "scope must be global, sector, or industry"
    columns = config.get("visible_columns")
    if not isinstance(columns, list) or len(columns) == 0:
        return False, "visible_columns must be a non-empty list"
    unknown = [c for c in columns if c not in ALLOWED_COLUMN_IDS]
    if unknown:
        return False, f"unknown column ids: {unknown[:5]}"
    return True, None


def _require_user():
    user = get_current_user()
    if user is None:
        return None, (jsonify({"error": "Authentication required"}), 401)
    return user, None


@templates_bp.route("/templates", methods=["GET"])
@login_required
def list_templates():
    user, err = _require_user()
    if err:
        return err
    seed_default_templates()
    defaults = (
        AnalysisTemplate.query.filter_by(is_default=True)
        .order_by(AnalysisTemplate.id.asc())
        .all()
    )
    mine = (
        AnalysisTemplate.query.filter_by(creator_id=user.id, is_default=False)
        .order_by(AnalysisTemplate.time_created.desc())
        .all()
    )
    return jsonify({
        "defaults": [t.to_dict(user.id) for t in defaults],
        "mine": [t.to_dict(user.id) for t in mine],
    }), 200


@templates_bp.route("/templates", methods=["POST"])
@login_required
def create_template():
    user, err = _require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    config = body.get("config")
    ok, msg = validate_template_config(config)
    if not ok:
        return jsonify({"error": msg}), 400
    radar = config["radar"]
    t = AnalysisTemplate(
        name=name[:100],
        description=(body.get("description") or "")[:255],
        creator_id=user.id,
        is_default=False,
        equations=radar["equations"],
        config=config,
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict(user.id)), 201


@templates_bp.route("/templates/<int:template_id>", methods=["PUT"])
@login_required
def update_template(template_id):
    user, err = _require_user()
    if err:
        return err
    t = db.session.get(AnalysisTemplate, template_id)
    if t is None:
        return jsonify({"error": "Not found"}), 404
    if t.is_default:
        return jsonify({"error": "Default templates cannot be edited. Save a copy instead."}), 403
    if t.creator_id != user.id:
        return jsonify({"error": "Forbidden"}), 403
    body = request.get_json(silent=True) or {}
    if "name" in body:
        name = (body.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name is required"}), 400
        t.name = name[:100]
    if "description" in body:
        t.description = (body.get("description") or "")[:255]
    if "config" in body:
        ok, msg = validate_template_config(body["config"])
        if not ok:
            return jsonify({"error": msg}), 400
        t.config = body["config"]
        t.equations = body["config"]["radar"]["equations"]
    db.session.commit()
    return jsonify(t.to_dict(user.id)), 200


@templates_bp.route("/templates/<int:template_id>", methods=["DELETE"])
@login_required
def delete_template(template_id):
    user, err = _require_user()
    if err:
        return err
    t = db.session.get(AnalysisTemplate, template_id)
    if t is None:
        return jsonify({"error": "Not found"}), 404
    if t.is_default:
        return jsonify({"error": "Default templates cannot be deleted"}), 403
    if t.creator_id != user.id:
        return jsonify({"error": "Forbidden"}), 403
    db.session.delete(t)
    db.session.commit()
    return jsonify({"ok": True}), 200


@templates_bp.route("/templates/<int:template_id>/clone", methods=["POST"])
@login_required
def clone_template(template_id):
    user, err = _require_user()
    if err:
        return err
    source = db.session.get(AnalysisTemplate, template_id)
    if source is None:
        return jsonify({"error": "Not found"}), 404
    if not source.is_default and source.creator_id != user.id:
        return jsonify({"error": "Forbidden"}), 403
    config = deepcopy(source.resolved_config())
    t = AnalysisTemplate(
        name=f"Copy of {source.name}"[:100],
        description=source.description or "",
        creator_id=user.id,
        is_default=False,
        equations=config["radar"]["equations"],
        config=config,
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict(user.id)), 201
