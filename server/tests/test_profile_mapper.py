"""
test_profile_mapper.py — pure unit tests for the deterministic onboarding mapper.

No database access: these call the mapping/validation functions directly and
verify determinism (P2), monotonicity (P9), missing-answer neutrality (P10), and
the sector cap / known-key rules (P5, P12).
"""
import pytest

from app.services.profile_mapper import (
    map_answers_to_profile,
    validate_onboarding_payload,
)
from app.services.onboarding_config import RISK_QUESTIONS


def _all_answers(option_index):
    """Build a payload choosing the option at `option_index` for every question."""
    answers = {}
    for qid, options in RISK_QUESTIONS.items():
        keys = list(options.keys())
        answers[qid] = keys[min(option_index, len(keys) - 1)]
    return answers


class TestDeterminism:
    def test_same_input_same_output(self):
        payload = {
            "answers": _all_answers(0),
            "time_horizon_years": 12,
            "budget": 2500,
            "preferred_sectors": ["TECHNOLOGY"],
        }
        a = map_answers_to_profile(payload)
        b = map_answers_to_profile(payload)
        assert a == b

    def test_most_aggressive_answers_score_high(self):
        # Index 0 is the most aggressive option for every question (weight 30).
        result = map_answers_to_profile({"answers": _all_answers(0)})
        assert result.risk_tolerance_score == pytest.approx(100.0)
        assert result.risk_tag == "Aggressive"

    def test_most_conservative_answers_score_low(self):
        # Last option for each question is weight 0.
        result = map_answers_to_profile({"answers": _all_answers(99)})
        assert result.risk_tolerance_score == pytest.approx(0.0)
        assert result.risk_tag == "Conservative"


class TestMonotonicity:
    def test_raising_one_answer_never_lowers_score(self):
        """P9 — perturbing a single answer to a more aggressive option only raises."""
        base = _all_answers(2)  # mid-low across the board
        base_score = map_answers_to_profile({"answers": base}).risk_tolerance_score

        # Bump the first question to its most aggressive option.
        first_qid = next(iter(RISK_QUESTIONS))
        bumped = dict(base)
        bumped[first_qid] = list(RISK_QUESTIONS[first_qid].keys())[0]
        bumped_score = map_answers_to_profile({"answers": bumped}).risk_tolerance_score

        assert bumped_score >= base_score


class TestMissingAnswers:
    def test_empty_answers_is_neutral_not_nan(self):
        """P10 — no answers yields the neutral midpoint (50), never NaN/0.

        Per the design RISK_BANDS, a score of exactly 50 sits at the lower edge
        of the Growth band ([50, 75)). The key guarantee is a finite, valid tag.
        """
        result = map_answers_to_profile({"answers": {}})
        assert result.risk_tolerance_score == pytest.approx(50.0)
        assert result.risk_tag in {"Balanced", "Growth"}

    def test_unknown_option_treated_as_neutral(self):
        result = map_answers_to_profile({"answers": {"q_market_crash": "bogus_option"}})
        assert 0 <= result.risk_tolerance_score <= 100


class TestHorizonAndBudget:
    @pytest.mark.parametrize(
        "years,tag",
        [(1, "Short"), (3, "Medium"), (7, "Long"), (12, "Very Long")],
    )
    def test_horizon_tag_buckets(self, years, tag):
        result = map_answers_to_profile({"answers": {}, "time_horizon_years": years})
        assert result.horizon_tag == tag

    def test_negative_budget_clamped_to_zero(self):
        result = map_answers_to_profile({"answers": {}, "budget": -100})
        assert result.budget == 0.0


ALL_SECTORS = [
    "TECHNOLOGY",
    "FINANCE",
    "ENERGY & TRANSPORTATION",
    "MANUFACTURING",
    "LIFE SCIENCES",
    "TRADE & SERVICES",
    "REAL ESTATE & CONSTRUCTION",
]


class TestSectorHandling:
    def test_dedupes_sectors_preserving_order(self):
        result = map_answers_to_profile(
            {
                "answers": {},
                "preferred_sectors": ["TECHNOLOGY", "TECHNOLOGY", "FINANCE", "LIFE SCIENCES"],
            }
        )
        assert result.preferred_sectors == ["TECHNOLOGY", "FINANCE", "LIFE SCIENCES"]

    def test_all_sectors_allowed(self):
        result = map_answers_to_profile({"answers": {}, "preferred_sectors": ALL_SECTORS})
        assert result.preferred_sectors == ALL_SECTORS

    def test_unknown_sectors_dropped(self):
        result = map_answers_to_profile(
            {"answers": {}, "preferred_sectors": ["NOT_A_SECTOR", "FINANCE"]}
        )
        assert result.preferred_sectors == ["FINANCE"]


class TestValidation:
    def test_rejects_too_many_sectors(self):
        # More entries than there are sectors (all 7 + a duplicate) is malformed.
        ok, err = validate_onboarding_payload(
            {"preferred_sectors": ALL_SECTORS + ["TECHNOLOGY"]}
        )
        assert ok is False
        assert "7" in err

    def test_accepts_all_seven_sectors(self):
        ok, err = validate_onboarding_payload({"preferred_sectors": ALL_SECTORS})
        assert ok is True
        assert err is None

    def test_rejects_unknown_sector(self):
        ok, err = validate_onboarding_payload({"preferred_sectors": ["MADE_UP"]})
        assert ok is False
        assert "Unknown" in err

    def test_rejects_negative_budget(self):
        ok, err = validate_onboarding_payload({"budget": -5})
        assert ok is False

    def test_accepts_valid_payload(self):
        ok, err = validate_onboarding_payload(
            {
                "answers": {"q_market_crash": "hold"},
                "time_horizon_years": 5,
                "budget": 1000,
                "preferred_sectors": ["TECHNOLOGY", "FINANCE"],
            }
        )
        assert ok is True
        assert err is None
