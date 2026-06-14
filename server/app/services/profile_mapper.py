"""
profile_mapper.py — pure, deterministic mapping from raw onboarding answers to a
persisted InvestorProfile. No I/O and no AI in the mapping itself (Property P2).

Public surface:
    map_answers_to_profile(payload)      -> ProfileResult   (pure)
    validate_onboarding_payload(payload) -> (ok, error)     (pure)
    persist_investor_profile(user, res)  -> InvestorProfile  (atomic write, P6/P8)
"""
from dataclasses import dataclass, field

from app import db
from app.models import InvestorProfile
from app.services.onboarding_config import (
    RISK_QUESTIONS,
    RISK_BANDS,
    MAX_POINTS_PER_QUESTION,
    NEUTRAL_POINTS,
    SECTOR_KEYS,
    MAX_SECTORS,
    horizon_tag_for,
)


@dataclass(frozen=True)
class ProfileResult:
    risk_tolerance_score: float        # 0-100
    risk_tag: str                      # Conservative | Balanced | Growth | Aggressive
    time_horizon_years: int
    horizon_tag: str                   # Short | Medium | Long | Very Long
    budget: float
    preferred_sectors: list            # <= 3 canonical keys
    raw_answers: dict = field(default_factory=dict)


def _risk_tag_for(score):
    """Bucket a 0-100 score into a tag. Clamped so out-of-range never escapes."""
    s = max(0.0, min(100.0, score))
    for low, high, tag in RISK_BANDS:
        if low <= s < high:
            return tag
    return RISK_BANDS[-1][2]  # defensive: top band


def _aggregate_risk_score(answers):
    """
    Aggregate per-question option points into a 0-100 score.

    - Every risk question contributes points in [0, MAX_POINTS_PER_QUESTION].
    - A missing/unknown answer contributes the neutral midpoint, never 0/NaN (P10).
    - The score is monotonic in answer aggression: raising one answer's points can
      only raise (never lower) the aggregate (P9).
    """
    total = 0.0
    for qid, options in RISK_QUESTIONS.items():
        chosen = answers.get(qid)
        if chosen is not None and chosen in options:
            total += float(options[chosen])
        else:
            total += NEUTRAL_POINTS
    max_total = len(RISK_QUESTIONS) * MAX_POINTS_PER_QUESTION
    if max_total <= 0:
        return 50.0
    return round((total / max_total) * 100.0, 2)


def _clean_sectors(sectors):
    """Dedupe (order-preserving), drop unknown keys, cap to MAX_SECTORS."""
    if not isinstance(sectors, list):
        return []
    cleaned = []
    for s in sectors:
        if s in SECTOR_KEYS and s not in cleaned:
            cleaned.append(s)
    return cleaned[:MAX_SECTORS]


def map_answers_to_profile(payload):
    """
    Deterministically map a raw onboarding payload to a ProfileResult. Identical
    input always yields identical output (P2). Assumes the payload already passed
    validate_onboarding_payload, but is defensive about missing/garbage fields.
    """
    answers = payload.get("answers") or {}
    if not isinstance(answers, dict):
        answers = {}

    score = _aggregate_risk_score(answers)
    risk_tag = _risk_tag_for(score)

    raw_years = payload.get("time_horizon_years")
    try:
        years = int(raw_years) if raw_years is not None else 0
    except (TypeError, ValueError):
        years = 0
    years = max(0, years)

    raw_budget = payload.get("budget")
    try:
        budget = float(raw_budget) if raw_budget is not None else 0.0
    except (TypeError, ValueError):
        budget = 0.0
    budget = max(0.0, budget)

    sectors = _clean_sectors(payload.get("preferred_sectors") or [])

    return ProfileResult(
        risk_tolerance_score=score,
        risk_tag=risk_tag,
        time_horizon_years=years,
        horizon_tag=horizon_tag_for(years) or "Short",
        budget=budget,
        preferred_sectors=sectors,
        raw_answers={k: v for k, v in answers.items() if isinstance(v, str)},
    )


def merge_onboarding_payload(payload, existing):
    """
    Build an "effective" payload for a partial update by layering the incoming
    payload over the user's existing profile. Only keys present in `payload`
    override; absent keys preserve the existing value. Answers are *merged* (so
    sending one answer, or none, never wipes the others).

    This lets a user update just one field (e.g. preferred_sectors) without
    re-answering the questionnaire, while keeping the mapping pure/deterministic.
    """
    payload = payload if isinstance(payload, dict) else {}

    existing_answers = (getattr(existing, "raw_answers", None) or {}) if existing else {}
    existing_years = getattr(existing, "time_horizon_years", None) if existing else None
    existing_budget = getattr(existing, "budget", None) if existing else None
    existing_sectors = (getattr(existing, "preferred_sectors", None) or []) if existing else []

    if "answers" in payload and isinstance(payload["answers"], dict):
        merged_answers = {**existing_answers, **payload["answers"]}
    else:
        merged_answers = existing_answers

    return {
        "answers": merged_answers,
        "time_horizon_years": payload["time_horizon_years"]
        if "time_horizon_years" in payload
        else existing_years,
        "budget": payload["budget"] if "budget" in payload else existing_budget,
        "preferred_sectors": payload["preferred_sectors"]
        if "preferred_sectors" in payload
        else existing_sectors,
    }


def validate_onboarding_payload(payload):
    """
    Shape + bounds checks. Returns (True, None) on success or (False, message).
    The server is the guarantee for the sector cap and known-key checks (P5, P12);
    the client checks are UX only.
    """
    if not isinstance(payload, dict):
        return False, "Payload must be a JSON object"

    answers = payload.get("answers", {})
    if answers is not None and not isinstance(answers, dict):
        return False, "answers must be an object"

    years = payload.get("time_horizon_years")
    if years is not None:
        try:
            if int(years) < 0:
                return False, "time_horizon_years must be >= 0"
        except (TypeError, ValueError):
            return False, "time_horizon_years must be an integer"

    budget = payload.get("budget")
    if budget is not None:
        try:
            if float(budget) < 0:
                return False, "budget must be >= 0"
        except (TypeError, ValueError):
            return False, "budget must be a number"

    sectors = payload.get("preferred_sectors", [])
    if sectors is not None:
        if not isinstance(sectors, list):
            return False, "preferred_sectors must be a list"
        if len(sectors) > MAX_SECTORS:
            return False, f"At most {MAX_SECTORS} preferred sectors are allowed"
        unknown = [s for s in sectors if s not in SECTOR_KEYS]
        if unknown:
            return False, f"Unknown sector(s): {', '.join(map(str, unknown))}"

    return True, None


def persist_investor_profile(user, result):
    """
    Upsert the user's InvestorProfile from a ProfileResult and sync the
    denormalized User columns, all in a single transaction (P6, P8).

    Idempotent: repeated calls with the same result keep exactly one row per
    user with identical values (P1).
    """
    profile = user.investor_profile
    if profile is None:
        profile = InvestorProfile(user_id=user.id)
        db.session.add(profile)

    profile.risk_tolerance_score = result.risk_tolerance_score
    profile.risk_tag = result.risk_tag
    profile.time_horizon_years = result.time_horizon_years
    profile.horizon_tag = result.horizon_tag
    profile.budget = result.budget
    profile.preferred_sectors = result.preferred_sectors
    profile.raw_answers = result.raw_answers
    profile.onboarding_completed = True

    # Keep the denormalized convenience columns on User in lock-step (P8).
    user.budget = result.budget
    user.risk_tolerance_score = result.risk_tolerance_score

    db.session.commit()
    return profile
