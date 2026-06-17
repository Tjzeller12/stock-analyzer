"""
personalization.py — read-only derivations consumed by downstream features.

Nothing here mutates state. Each function degrades gracefully when the user has
no completed profile so that an incomplete profile never blocks the app (P4).
"""
from app.services.onboarding_config import LOW_BUDGET_THRESHOLD

# Above this budget (USD) a user is treated as "high" for the index-fallback
# decision in the deterministic-portfolio feature.
HIGH_BUDGET_THRESHOLD = 25000.0

# Hard cap on the injected prompt-context string so it can never blow the
# downstream Claude token budget (P11).
MAX_CONTEXT_CHARS = 400


def _completed_profile(user):
    """Return the user's InvestorProfile iff onboarding is complete, else None."""
    profile = getattr(user, "investor_profile", None)
    if profile is not None and profile.onboarding_completed:
        return profile
    return None


def budget_band(profile):
    """'micro' (< LOW_BUDGET_THRESHOLD), 'standard', or 'high' (>= HIGH_BUDGET_THRESHOLD).

    Accepts an InvestorProfile or anything with a numeric `budget` attribute.
    Falls back to 'standard' when the budget is unknown.
    """
    budget = getattr(profile, "budget", None) if profile is not None else None
    try:
        budget = float(budget)
    except (TypeError, ValueError):
        return "standard"
    if budget < LOW_BUDGET_THRESHOLD:
        return "micro"
    if budget >= HIGH_BUDGET_THRESHOLD:
        return "high"
    return "standard"


def build_profile_context(user):
    """
    Produce a BOUNDED, fixed-schema string summarizing the profile for injection
    into Claude prompts. Returns "" when there is no completed profile (P4, P11).
    """
    profile = _completed_profile(user)
    if profile is None:
        return ""

    sectors = profile.preferred_sectors or []
    sectors_str = ", ".join(sectors) if sectors else "none specified"

    context = (
        "<investor_profile>\n"
        f"risk: {profile.risk_tag} ({int(round(profile.risk_tolerance_score or 0))}/100)\n"
        f"horizon: {profile.horizon_tag} ({profile.time_horizon_years}y)\n"
        f"budget_band: {budget_band(profile)}\n"
        f"preferred_sectors: {sectors_str}\n"
        "</investor_profile>"
    )

    # Defensive truncation — the schema is fixed and sectors are capped (P5), but
    # we still guarantee the bound (P11).
    if len(context) > MAX_CONTEXT_CHARS:
        context = context[:MAX_CONTEXT_CHARS]
    return context


# --- Suggested default radar template ---------------------------------------
# Same shape as the client RadarTemplate / AdvancedSettingsPanel.DEFAULT_TEMPLATE.
# These are only *suggested* starting points; applying one is an explicit, opt-in
# user action and never overwrites a saved custom template (P7).

_CONSERVATIVE_TEMPLATE = {
    "name": "Suggested: Stability First",
    "normalization_method": "min-max",
    "scope": "global",
    "equations": {
        "Valuation": "(1 - forward_pe) * 0.4 + (1 - ev_to_ebitda) * 0.3 + (1 - price_to_fc) * 0.3",
        "Stability": "(1 - debt_to_equity) * 0.4 + (1 - beta) * 0.4 + dividend_yield * 0.2",
        "Efficiency": "roe * 0.4 + roa * 0.3 + profit_margin * 0.3",
        "Sentiment": "ai_moat_score * 0.7 + ai_news_score * 0.3",
    },
}

_BALANCED_TEMPLATE = {
    "name": "Suggested: Balanced Core",
    "normalization_method": "min-max",
    "scope": "global",
    "equations": {
        "Valuation": "(1 - forward_pe) * 0.4 + (1 - ev_to_ebitda) * 0.3 + (1 - price_to_fc) * 0.3",
        "Growth": "0.4 + (eps_growth_qoq * 0.3) + (rev_growth_qoq * 0.3)",
        "Stability": "(1 - debt_to_equity) * 0.4 + (1 - beta) * 0.4 + dividend_yield * 0.2",
        "Efficiency": "roe * 0.4 + roa * 0.3 + profit_margin * 0.3",
        "Sentiment": "ai_moat_score * 0.6 + ai_news_score * 0.4",
    },
}

_GROWTH_TEMPLATE = {
    "name": "Suggested: Growth Tilt",
    "normalization_method": "min-max",
    "scope": "global",
    "equations": {
        "Growth": "0.3 + (eps_growth_qoq * 0.35) + (rev_growth_qoq * 0.35)",
        "Efficiency": "roe * 0.4 + roa * 0.2 + roic * 0.4",
        "Valuation": "(1 - peg_ratio) * 0.5 + (1 - price_to_sales) * 0.5",
        "Sentiment": "ai_moat_score * 0.5 + ai_news_score * 0.5",
    },
}

_AGGRESSIVE_TEMPLATE = {
    "name": "Suggested: High Conviction Growth",
    "normalization_method": "z-score",
    "scope": "sector",
    "equations": {
        "Growth": "0.2 + (eps_growth_qoq * 0.4) + (rev_growth_qoq * 0.4)",
        "Efficiency": "roic * 0.5 + roe * 0.3 + profit_margin * 0.2",
        "Momentum": "ai_news_score * 0.6 + (rev_growth_qoq * 0.4)",
        "Sentiment": "ai_moat_score * 0.5 + ai_news_score * 0.5",
    },
}

_TEMPLATE_BY_RISK_TAG = {
    "Conservative": _CONSERVATIVE_TEMPLATE,
    "Balanced": _BALANCED_TEMPLATE,
    "Growth": _GROWTH_TEMPLATE,
    "Aggressive": _AGGRESSIVE_TEMPLATE,
}


def suggest_default_template(profile):
    """
    Map a profile to a *suggested* starting RadarTemplate dict based on risk tag.
    Returns a deep-ish copy so callers can't mutate the module-level presets.
    Falls back to the Balanced template when the profile/risk tag is unknown (P4).
    Purely advisory — never persisted automatically (P7).
    """
    risk_tag = getattr(profile, "risk_tag", None) if profile is not None else None
    template = _TEMPLATE_BY_RISK_TAG.get(risk_tag, _BALANCED_TEMPLATE)
    return {
        "name": template["name"],
        "normalization_method": template["normalization_method"],
        "scope": template["scope"],
        "equations": dict(template["equations"]),
    }
