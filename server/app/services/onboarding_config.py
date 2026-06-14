"""
onboarding_config.py — server-authoritative configuration for the investor
onboarding questionnaire.

This is the source of truth for scoring. The client ships a mirror of these
weights for a *cosmetic* preview, but the server re-derives the profile from the
raw answers on every PUT (see Correctness Property P2). Keeping the scoring here
(not in the route) makes it a pure, table-driven, unit-testable map.

`SECTOR_KEYS` MUST stay aligned with the values Alpha Vantage's OVERVIEW endpoint
stores in StockMaster.sector, so preferred_sectors is join-compatible downstream
without a translation layer (Correctness Property P12).
"""

# --- Behavioral risk questions ---------------------------------------------
# question_id -> { option_id: points }. Every risk question uses the same 0..30
# scale so the neutral midpoint is uniform and the aggregate is easy to reason
# about. A higher point value == a more risk-tolerant answer.
MAX_POINTS_PER_QUESTION = 30
NEUTRAL_POINTS = MAX_POINTS_PER_QUESTION / 2.0  # contributed by unanswered questions (P10)

RISK_QUESTIONS = {
    "q_market_crash": {
        "buy_more": 30,
        "hold": 20,
        "trim": 10,
        "exit": 0,
    },
    "q_sleep_vs_moonshot": {
        "moonshot": 30,
        "tilt_growth": 20,
        "balanced": 10,
        "sleep": 0,
    },
    "q_windfall": {
        "all_in": 30,
        "mostly_invest": 20,
        "split": 10,
        "save_cash": 0,
    },
    "q_check_frequency": {
        "never_set_forget": 30,
        "monthly": 20,
        "weekly": 10,
        "daily_anxious": 0,
    },
    "q_loss_tolerance": {
        "down_50": 30,
        "down_30": 20,
        "down_15": 10,
        "down_0": 0,
    },
}

# --- Risk score → tag bands (lower-inclusive, upper-exclusive) --------------
RISK_BANDS = [
    (0, 25, "Conservative"),
    (25, 50, "Balanced"),
    (50, 75, "Growth"),
    (75, 101, "Aggressive"),
]

# --- Time horizon (years) → tag thresholds ---------------------------------
# < 2y Short, 2-5y Medium, 5-10y Long, 10y+ Very Long
def horizon_tag_for(years):
    if years is None:
        return None
    if years < 2:
        return "Short"
    if years < 5:
        return "Medium"
    if years < 10:
        return "Long"
    return "Very Long"


# --- Sectors -----------------------------------------------------------------
# Canonical Alpha Vantage OVERVIEW "Sector" taxonomy (exact strings stored in
# StockMaster.sector). Do not rename without a data migration (P12).
SECTOR_KEYS = {
    "TECHNOLOGY",
    "FINANCE",
    "ENERGY & TRANSPORTATION",
    "MANUFACTURING",
    "LIFE SCIENCES",
    "TRADE & SERVICES",
    "REAL ESTATE & CONSTRUCTION",
}

# There are only 7 canonical sectors, so allow selecting all of them — no
# artificial cap on diversification. Kept as a constant so it stays the single
# source of truth and the server still rejects malformed over-length payloads.
MAX_SECTORS = len(SECTOR_KEYS)

# Below this budget (USD) the UI surfaces broad-index-fund guidance and the
# deterministic-portfolio feature (07) prefers an index fallback.
LOW_BUDGET_THRESHOLD = 500.0
