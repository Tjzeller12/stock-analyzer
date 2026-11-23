"""
discovery.py — the tailored discovery route (feature 02).

POST /discovery/generate
    Body: { "refinements": ["Exclude EV companies", ...] }
    Returns: { "recommendations": [...], "generated_from": {...} }

The server is stateless: the client holds the refinement "session" and resends the
full list each call. We rebuild the prompt deterministically from
(profile_context + refinements), so identical requests hit the cache (P3, P7).
"""
from flask import Blueprint, jsonify, request

from app import cache
from app.alphaBot.client import AlphaBotClient
from app.alphaBot.prompt import PromptNotFoundError
from app.routes.auth import get_current_user
from app.services.discovery import (
    DiscoveryParser,
    SuperPrompt,
    _sanitize_refinements,
    profile_signature,
    refinements_hash,
)
from app.services.personalization import build_profile_context

discovery_bp = Blueprint("discovery", __name__)

DISCOVERY_CACHE_TTL = 900  # 15 min, consistent with the analysis caches


@discovery_bp.route("/discovery/generate", methods=["POST"])
def generate_discovery():
    user = get_current_user()
    if user is None:
        return jsonify({"error": "User not logged in"}), 401

    body = request.get_json(silent=True) or {}
    refinements = _sanitize_refinements(body.get("refinements", []))

    profile_ctx = build_profile_context(user)  # "" when onboarding incomplete (P1)
    cache_key = f"discovery:{profile_signature(user)}:{refinements_hash(refinements)}"

    cached = cache.get(cache_key)
    if cached is not None:
        return jsonify(cached), 200

    try:
        prompt = SuperPrompt.build(profile_ctx, refinements)
        result = AlphaBotClient.run_sync(prompt, include_tools=True)
        recs = DiscoveryParser.parse(result.text)  # [] on any failure (P2)
    except PromptNotFoundError:
        return jsonify({"error": "Discovery prompt is unavailable"}), 500
    except Exception:
        # Never leak internals; degrade to an empty result the page can render.
        recs = []
        result = None

    payload = {
        "recommendations": [r.to_dict() for r in recs],
        "generated_from": {
            "has_profile": bool(profile_ctx),
            "refinement_count": len(refinements),
        },
    }

    # Only cache real, non-empty results (errors/empties are never cached) (P7).
    if recs and result is not None and result.cacheable:
        cache.set(cache_key, payload, timeout=DISCOVERY_CACHE_TTL)

    return jsonify(payload), 200
