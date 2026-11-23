"""
usage_limiter.py — AlphaBot per-day usage enforcement.

Tiers
-----
  free : 3 AlphaBot calls per calendar day (resets at midnight server time)
  dev  : unlimited

Usage
-----
Apply @alphabot_rate_limit to any AlphaBot route that should be metered.
The decorator also enforces authentication, so @login_required is not needed
separately on those routes.
"""
from datetime import date
from functools import wraps

from flask import jsonify

from app import db
from app.routes.auth import get_current_user

DAILY_LIMITS: dict = {
    'free': 3,
    'dev': None,   # None = unlimited
}


def alphabot_rate_limit(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if user is None:
            return jsonify({"error": "Authentication required"}), 401

        limit = DAILY_LIMITS.get(user.tier, 3)

        if limit is None:
            return f(*args, **kwargs)

        today = date.today()
        if user.alphabot_last_use_date != today:
            user.alphabot_daily_uses = 0
            user.alphabot_last_use_date = today

        if user.alphabot_daily_uses >= limit:
            return jsonify({
                "error": "Daily AlphaBot limit reached. You get 3 free queries per day — come back tomorrow!",
                "uses": user.alphabot_daily_uses,
                "limit": limit,
                "tier": user.tier,
            }), 429

        user.alphabot_daily_uses += 1
        db.session.commit()
        return f(*args, **kwargs)

    return decorated
