"""
test_allocation_engine.py — pure unit tests for the allocation engine.

No database, no Flask app, no API calls. Each test builds a few
CandidateStock objects by hand, calls one engine function, and checks
the result. Design: planning/07-deterministic-portfolio/design.md
(property P3: only names with a score above 50, a sector, and a price
are kept; P7: every candidate is either kept or skipped with a reason).
"""
import math

import pytest

from app.services.allocation_engine import (
    CandidateStock,
    get_eligible_candidates,
    get_skipped_reason,
)

# The design's score floor. Kept here so every test uses the same number.
SCORE_FLOOR = 50


# --- Helpers -----------------------------------------------------------------
# A helper builds a valid stock with sensible defaults, so each test only
# spells out the one field it cares about. `stock("X", price=None)` reads as
# "a normal stock, except it has no price".
def stock(symbol, *, price=100.0, radar_score=70.0, sector="Technology"):
    return CandidateStock(
        symbol=symbol, price=price, radar_score=radar_score, sector=sector
    )


def symbols_by_sector(kept):
    """Turn {sector: [CandidateStock, ...]} into {sector: [symbol, ...]}.

    Comparing symbols gives a short, readable failure message instead of
    a wall of dataclass reprs.
    """
    return {sector: [c.symbol for c in names] for sector, names in kept.items()}


def reasons_by_symbol(skipped):
    """Turn a tuple of SkippedName into {symbol: reason}."""
    return {s.symbol: s.reason for s in skipped}


# --- get_skipped_reason: one rule per test ----------------------------------
# Testing the small function directly means a failure points at exactly one
# rule. `parametrize` runs the same test body once per row in the list, and
# pytest reports each row separately (with the id shown in brackets).
class TestGetSkippedReason:
    def test_good_stock_has_no_reason(self):
        assert get_skipped_reason(stock("AAPL"), SCORE_FLOOR) is None

    @pytest.mark.parametrize(
        "candidate, expected",
        [
            (stock("A", price=None), "no_price"),
            (stock("B", price=0.0), "no_price"),
            (stock("C", price=-5.0), "no_price"),
            (stock("D", sector=None), "no_sector"),
            (stock("E", sector=""), "no_sector"),
            (stock("F", radar_score=None), "no_score"),
            (stock("G", radar_score=30.0), "low_score"),
        ],
        ids=[
            "price None",
            "price zero",
            "price negative",
            "sector None",
            "sector empty string",
            "score None",
            "score below floor",
        ],
    )
    def test_each_reason(self, candidate, expected):
        assert get_skipped_reason(candidate, SCORE_FLOOR) == expected

    # Boundaries are where off-by-one bugs live. The design says "above 50",
    # so exactly 50 is skipped and anything above it is kept.
    def test_score_exactly_at_floor_is_low_score(self):
        assert get_skipped_reason(stock("A", radar_score=50.0), SCORE_FLOOR) == "low_score"

    def test_score_just_above_floor_is_kept(self):
        assert get_skipped_reason(stock("A", radar_score=50.1), SCORE_FLOOR) is None

    # NaN ("not a number") compares False to everything: NaN > 50 is False
    # AND NaN <= 50 is False. A check written as `score <= floor` lets NaN
    # through. A NaN score is no score, so it must be skipped.
    def test_nan_score_is_no_score(self):
        assert get_skipped_reason(stock("A", radar_score=math.nan), SCORE_FLOOR) == "no_score"

    # When a stock has several problems, the order of the checks decides which
    # reason wins. Pinning the order here means a reshuffle is a deliberate
    # change, not an accident. Order: price, sector, score.
    def test_price_problem_wins_over_everything(self):
        broken = stock("A", price=None, sector=None, radar_score=None)
        assert get_skipped_reason(broken, SCORE_FLOOR) == "no_price"

    def test_sector_problem_wins_over_score_problem(self):
        broken = stock("A", sector=None, radar_score=10.0)
        assert get_skipped_reason(broken, SCORE_FLOOR) == "no_sector"


# --- get_eligible_candidates: the whole filter ------------------------------
class TestGetEligibleCandidates:
    def test_happy_path_groups_kept_names_by_sector(self):
        candidates = (
            stock("AAPL", sector="Technology", radar_score=72.0),
            stock("JPM", sector="Financial Services", radar_score=64.0),
            stock("MSFT", sector="Technology", radar_score=68.0),
            stock("XOM", sector="Energy", radar_score=40.0),  # below floor
        )

        kept, skipped = get_eligible_candidates(candidates, SCORE_FLOOR)

        # Input order is kept inside each sector; sorting is seat's job.
        assert symbols_by_sector(kept) == {
            "Technology": ["AAPL", "MSFT"],
            "Financial Services": ["JPM"],
        }
        assert reasons_by_symbol(skipped) == {"XOM": "low_score"}

    def test_skipped_name_carries_the_stock_details(self):
        # The Next list and the logs need the symbol, sector, and price of a
        # skipped name, not just its reason.
        kept, skipped = get_eligible_candidates(
            (stock("XOM", sector="Energy", price=110.0, radar_score=40.0),),
            SCORE_FLOOR,
        )
        assert kept == {}
        assert len(skipped) == 1
        assert skipped[0].symbol == "XOM"
        assert skipped[0].sector == "Energy"
        assert skipped[0].price == 110.0
        assert skipped[0].reason == "low_score"

    def test_one_of_each_reason(self):
        candidates = (
            stock("GOOD"),
            stock("NOPRICE", price=None),
            stock("NOSECTOR", sector=None),
            stock("NOSCORE", radar_score=None),
            stock("LOW", radar_score=20.0),
        )

        kept, skipped = get_eligible_candidates(candidates, SCORE_FLOOR)

        assert symbols_by_sector(kept) == {"Technology": ["GOOD"]}
        assert reasons_by_symbol(skipped) == {
            "NOPRICE": "no_price",
            "NOSECTOR": "no_sector",
            "NOSCORE": "no_score",
            "LOW": "low_score",
        }

    def test_empty_candidates(self):
        kept, skipped = get_eligible_candidates((), SCORE_FLOOR)
        assert kept == {}
        assert skipped == ()

    def test_every_candidate_skipped(self):
        candidates = (
            stock("A", radar_score=10.0),
            stock("B", radar_score=50.0),
            stock("C", price=None),
        )
        kept, skipped = get_eligible_candidates(candidates, SCORE_FLOOR)
        assert kept == {}
        assert [s.symbol for s in skipped] == ["A", "B", "C"]

    def test_every_candidate_kept(self):
        candidates = (
            stock("A", sector="Technology"),
            stock("B", sector="Energy"),
            stock("C", sector="Technology"),
        )
        kept, skipped = get_eligible_candidates(candidates, SCORE_FLOOR)
        assert symbols_by_sector(kept) == {"Technology": ["A", "C"], "Energy": ["B"]}
        assert skipped == ()

    # P7: nothing disappears. Every input comes out exactly once, either kept
    # or skipped. This catches a bug like a forgotten `else` that drops names.
    def test_every_candidate_is_accounted_for(self):
        candidates = (
            stock("A"),
            stock("B", radar_score=None),
            stock("C", sector="Energy"),
            stock("D", price=0.0),
            stock("E", radar_score=50.0),
        )
        kept, skipped = get_eligible_candidates(candidates, SCORE_FLOOR)

        kept_symbols = [c.symbol for names in kept.values() for c in names]
        skipped_symbols = [s.symbol for s in skipped]
        assert sorted(kept_symbols + skipped_symbols) == ["A", "B", "C", "D", "E"]

    # The skipped list must be a tuple so the frozen AllocationPlan stays
    # truly read-only (a list could still be appended to).
    def test_skipped_is_a_tuple(self):
        _, skipped = get_eligible_candidates((stock("A", radar_score=1.0),), SCORE_FLOOR)
        assert isinstance(skipped, tuple)

    # A floor outside 0..100 is a programming mistake, not missing data, so it
    # fails loudly instead of quietly keeping or dropping every stock.
    # `pytest.raises` passes only if the code inside raises that error.
    @pytest.mark.parametrize("bad_floor", [-1, 100.5, math.nan])
    def test_invalid_floor_raises(self, bad_floor):
        with pytest.raises(ValueError):
            get_eligible_candidates((stock("A"),), bad_floor)
