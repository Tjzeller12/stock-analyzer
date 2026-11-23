"""
discovery.py — the Super Prompt discovery engine (feature 02).

Pure, deterministic helpers around the AI layer:
  - SuperPrompt.build    : render the master template from profile context + refinements
  - DiscoveryParser.parse : tolerant strict-JSON parse → validated Recommendation list
  - profile_signature     : stable cache key from the recommendation-relevant profile fields
  - _sanitize_refinements : strip + cap incoming refinements (server-side guarantee)

Nothing here calls Claude or touches the DB beyond reading the user's profile via
the personalization service; the route owns the AI call and caching. Keeping the
string-building deterministic is what makes the cache key stable (P3, P7).
"""
import hashlib
import json
import re
from dataclasses import dataclass

from app.alphaBot.prompt import PromptTemplate, PromptNotFoundError
from app.constants import SUPER_PROMPT_PROMPT
from app.services.personalization import _completed_profile, budget_band

# Bounds — enforced server-side regardless of what the client sends (P5, P2).
MAX_REFINEMENTS = 8
MAX_RECOMMENDATIONS = 8
MAX_REFINEMENT_CHARS = 200
MAX_RATIONALE_SENTENCES = 2
MAX_RATIONALE_CHARS = 320


@dataclass(frozen=True)
class Recommendation:
    ticker: str
    company_name: str
    rationale: str
    sector: str | None = None

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "company_name": self.company_name,
            "rationale": self.rationale,
            "sector": self.sector,
        }


def _sanitize_refinements(raw) -> list[str]:
    """Coerce, strip, drop empties, bound length, and cap count. Deterministic so
    the same client input always yields the same prompt + cache key (P5)."""
    if not isinstance(raw, list):
        return []
    cleaned: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text:
            continue
        cleaned.append(text[:MAX_REFINEMENT_CHARS])
        if len(cleaned) >= MAX_REFINEMENTS:
            break
    return cleaned


def _render_refinements_block(refinements: list[str]) -> str:
    """Numbered list so the prompt can say 'later ones take precedence'."""
    if not refinements:
        return "(none — use the profile only)"
    return "\n".join(f"{i}. {r}" for i, r in enumerate(refinements, start=1))


def profile_signature(user) -> str:
    """Stable hash of ONLY the profile fields that affect recommendations:
    risk_tag, horizon_tag, budget_band, and sorted preferred_sectors. Cosmetic
    profile edits don't bust the discovery cache; meaningful ones do (P7).

    Falls back to a fixed 'noprofile' signature when onboarding is incomplete, so
    all profile-less users share the generic cached result."""
    profile = _completed_profile(user)
    if profile is None:
        return "noprofile"
    parts = [
        str(profile.risk_tag or ""),
        str(profile.horizon_tag or ""),
        budget_band(profile),
        ",".join(sorted(profile.preferred_sectors or [])),
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def refinements_hash(refinements: list[str]) -> str:
    """Order-sensitive hash of the (already sanitized) refinements list."""
    raw = "\u0001".join(refinements)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


class SuperPrompt:
    @staticmethod
    def build(profile_ctx: str, refinements: list[str]) -> str:
        """Render the master template. With an empty profile_ctx the template still
        produces a runnable prompt for a generic long-term starter list (P1)."""
        profile_block = profile_ctx if profile_ctx else (
            "(no saved investor profile — recommend a sensible, diversified "
            "long-term starter list for a new investor)"
        )
        return PromptTemplate.load(SUPER_PROMPT_PROMPT).render(
            profile_context=profile_block,
            refinements_block=_render_refinements_block(refinements),
            max_recommendations=MAX_RECOMMENDATIONS,
        )


_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,11}$")


def _bound_rationale(text: str) -> str:
    """Truncate a rationale to at most MAX_RATIONALE_SENTENCES sentences and a hard
    char cap so a verbose model response can't produce oversized cards (P10)."""
    text = " ".join(str(text).split())  # collapse whitespace
    sentences = re.split(r"(?<=[.!?])\s+", text)
    bounded = " ".join(sentences[:MAX_RATIONALE_SENTENCES]).strip()
    if len(bounded) > MAX_RATIONALE_CHARS:
        bounded = bounded[:MAX_RATIONALE_CHARS].rstrip() + "…"
    return bounded


class DiscoveryParser:
    @staticmethod
    def parse(text: str) -> list[Recommendation]:
        """Single choke point for model output. Strips fences, parses JSON, validates
        each element, dedupes by ticker, caps the count, and returns [] on ANY
        failure rather than raising (P2, P6, P10)."""
        try:
            clean = (text or "").replace("```json", "").replace("```", "").strip()
            data = json.loads(clean)
        except (json.JSONDecodeError, TypeError):
            return []

        if not isinstance(data, list):
            # Tolerate a top-level object that wraps the array.
            if isinstance(data, dict):
                for key in ("recommendations", "stocks", "results", "data"):
                    if isinstance(data.get(key), list):
                        data = data[key]
                        break
                else:
                    return []
            else:
                return []

        recs: list[Recommendation] = []
        seen: set[str] = set()
        for item in data:
            if not isinstance(item, dict):
                continue
            ticker = str(item.get("ticker", "")).strip().upper()
            company = str(item.get("company_name", "")).strip()
            rationale = item.get("rationale", "")
            if not ticker or not _TICKER_RE.match(ticker):
                continue
            if not company:
                continue
            if ticker in seen:
                continue
            sector = item.get("sector")
            sector = str(sector).strip() if sector else None
            recs.append(
                Recommendation(
                    ticker=ticker,
                    company_name=company[:120],
                    rationale=_bound_rationale(rationale),
                    sector=sector[:60] if sector else None,
                )
            )
            seen.add(ticker)
            if len(recs) >= MAX_RECOMMENDATIONS:
                break
        return recs
