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


from app.services.template_seed import radar_for_risk_tag


def suggest_default_template(profile):
    """
    Map a profile to a *suggested* starting RadarTemplate dict based on risk tag.
    Returns a copy so callers can't mutate the seed. Falls back to Balanced
    when the profile/risk tag is unknown (P4).
    """
    risk_tag = getattr(profile, "risk_tag", None) if profile is not None else None
    return radar_for_risk_tag(risk_tag)
