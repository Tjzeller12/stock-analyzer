"""
Four read-only default templates, one per investor risk_tag.

These are the product defaults — not placeholders. Equations use real
StockMaster / RADAR_METRICS fields. seed_default_templates() is idempotent.
"""
from copy import deepcopy

from app import db
from app.models import AnalysisTemplate

QUOTE_COLUMNS = ["name", "price", "price_change_percent", "market_cap"]

# Each template's columns mirror the inputs to its own equations, so the table
# explains the radar rather than showing an unrelated set of numbers.
CONSERVATIVE_COLUMNS = QUOTE_COLUMNS + [
    "dividend_yield", "forward_pe", "price_to_book", "debt_to_equity",
    "beta", "roe", "operating_margin", "profit_margin",
]
BALANCED_COLUMNS = QUOTE_COLUMNS + [
    "forward_pe", "peg_ratio", "dividend_yield", "roe", "operating_margin",
    "rev_growth_qoq", "eps_growth_qoq", "debt_to_equity", "beta",
    "ai_moat_score", "ai_news_score",
]
GROWTH_COLUMNS = QUOTE_COLUMNS + [
    "rev_growth_qoq", "eps_growth_qoq", "peg_ratio", "price_to_sales",
    "roe", "operating_margin", "profit_margin", "debt_to_equity",
    "ai_moat_score",
]
AGGRESSIVE_COLUMNS = QUOTE_COLUMNS + [
    "rev_growth_qoq", "eps_growth_qoq", "peg_ratio", "price_to_sales",
    "operating_margin", "roe", "buy_ratings_count",
    "ai_news_score", "ai_moat_score",
]

ALLOWED_COLUMN_IDS = {
    "name", "price", "price_change_percent", "market_cap", "volume",
    "pe_ratio", "forward_pe", "dividend_yield", "ev_to_ebitda",
    "price_to_sales", "price_to_book", "peg_ratio", "roe", "operating_margin", "profit_margin",
    "roa", "rev_growth_qoq", "eps_growth_qoq", "total_assets",
    "total_liabilities", "operating_cash_flow", "capital_expenditures",
    "free_cash_flow", "debt_to_equity", "beta", "buy_ratings_count",
    "insider_volume", "ai_moat_score", "ai_news_score",
}

DEFAULT_TEMPLATES = [
    {
        "name": "Stability First",
        "profile_risk_tag": "Conservative",
        "description": (
            "For capital preservation. Favors cheap, low-leverage, low-beta "
            "companies with durable margins and a real dividend."
        ),
        "config": {
            "radar": {
                "name": "Stability First",
                "scope": "global",
                "equations": {
                    # Cheapness on three independent yardsticks. Earnings-based
                    # P/E leads; P/B and P/S keep the axis honest for companies
                    # whose earnings are temporarily depressed.
                    "Valuation": "0.45 * (1 - forward_pe) + 0.30 * (1 - price_to_book) + 0.25 * (1 - price_to_sales)",
                    # Survives a downturn: little debt, moves less than the
                    # market, and earns enough margin to absorb a bad quarter.
                    "Stability": "0.45 * (1 - debt_to_equity) + 0.35 * (1 - beta) + 0.20 * profit_margin",
                    # Operating margin leads because it is the least distorted by
                    # leverage -- ROE alone rewards a balance sheet full of debt.
                    "Efficiency": "0.40 * operating_margin + 0.35 * roe + 0.25 * roa",
                    # Income is its own axis here: a conservative investor decides
                    # on yield separately from whether the stock is cheap.
                    "Income": "dividend_yield",
                    "Sentiment": "0.70 * ai_moat_score + 0.30 * ai_news_score",
                },
            },
            "visible_columns": CONSERVATIVE_COLUMNS,
        },
    },
    {
        "name": "Balanced Core",
        "profile_risk_tag": "Balanced",
        "description": (
            "Even mix of valuation, growth, and stability. Fallback when the "
            "investor profile is incomplete."
        ),
        "config": {
            "radar": {
                "name": "Balanced Core",
                "scope": "global",
                "equations": {
                    # PEG carries a third of the weight so the axis rewards a
                    # fair price for growth, not just the lowest multiple.
                    "Valuation": "0.40 * (1 - forward_pe) + 0.35 * (1 - peg_ratio) + 0.25 * (1 - price_to_sales)",
                    # Revenue leads earnings: top-line growth is harder to
                    # manufacture through buybacks or one-off charges.
                    "Growth": "0.55 * rev_growth_qoq + 0.45 * eps_growth_qoq",
                    "Stability": "0.40 * (1 - debt_to_equity) + 0.30 * (1 - beta) + 0.30 * dividend_yield",
                    "Efficiency": "0.40 * roe + 0.30 * operating_margin + 0.30 * roa",
                    "Sentiment": "0.60 * ai_moat_score + 0.40 * ai_news_score",
                },
            },
            "visible_columns": BALANCED_COLUMNS,
        },
    },
    {
        "name": "Growth Tilt",
        "profile_risk_tag": "Growth",
        "description": (
            "Weights revenue and earnings growth plus the margins that fund it. "
            "Values names on PEG and sales, not deep-value multiples."
        ),
        "config": {
            "radar": {
                "name": "Growth Tilt",
                "scope": "global",
                "equations": {
                    "Growth": "0.55 * rev_growth_qoq + 0.45 * eps_growth_qoq",
                    # Margins, not ROE alone -- a growth company reinvesting hard
                    # can show a thin ROE while compounding perfectly well.
                    "Efficiency": "0.40 * roe + 0.35 * operating_margin + 0.25 * profit_margin",
                    "Valuation": "0.55 * (1 - peg_ratio) + 0.45 * (1 - price_to_sales)",
                    # Growth still has to be survivable: leverage is the usual way
                    # a fast grower turns a bad quarter into a permanent loss.
                    "Stability": "0.60 * (1 - debt_to_equity) + 0.40 * profit_margin",
                    "Sentiment": "0.50 * ai_moat_score + 0.50 * ai_news_score",
                },
            },
            "visible_columns": GROWTH_COLUMNS,
        },
    },
    {
        "name": "High Conviction Growth",
        "profile_risk_tag": "Aggressive",
        "description": (
            "Sector-relative growth and momentum. Accepts higher beta for "
            "upside; weak on dividend and balance-sheet screens."
        ),
        "config": {
            "radar": {
                "name": "High Conviction Growth",
                "scope": "sector",
                "equations": {
                    # Top-line and bottom-line growth get separate axes: they are
                    # different signals, and together they give this template the
                    # growth tilt its name promises. Splitting them is not the
                    # double-count the old Momentum axis had, where rev_growth_qoq
                    # was blended in on top of the Growth axis that already held it.
                    "Revenue Growth": "rev_growth_qoq",
                    "Earnings Growth": "eps_growth_qoq",
                    # Narrative and analyst conviction. ai_news_score appears here
                    # and nowhere else, so it cannot inflate two axes at once.
                    "Momentum": "0.65 * ai_news_score + 0.35 * buy_ratings_count",
                    # The durable side of the story, kept to one axis so it informs
                    # without outvoting growth.
                    "Franchise": "0.60 * ai_moat_score + 0.40 * operating_margin",
                    # Price paid is shown, not ignored -- but it is one axis of five.
                    "Valuation": "0.60 * (1 - peg_ratio) + 0.40 * (1 - price_to_sales)",
                },
            },
            "visible_columns": AGGRESSIVE_COLUMNS,
        },
    },
]


def _spec_by_risk_tag(risk_tag):
    for spec in DEFAULT_TEMPLATES:
        if spec["profile_risk_tag"] == risk_tag:
            return spec
    return next(s for s in DEFAULT_TEMPLATES if s["profile_risk_tag"] == "Balanced")


def radar_for_risk_tag(risk_tag=None):
    """Radar payload (copy) for suggest_default_template. Balanced if unknown."""
    spec = _spec_by_risk_tag(risk_tag)
    return deepcopy(spec["config"]["radar"])


def seed_default_templates():
    """
    Insert each default, and refresh it in place when this file's spec changes.

    Defaults are read-only to users, so nothing hand-edited can be lost here.
    Without the refresh an existing database would keep serving whatever
    equations shipped first and never pick up a correction.
    """
    from sqlalchemy import inspect

    inspector = inspect(db.engine)
    if "analysis_template" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("analysis_template")}
    if "config" not in cols or "profile_risk_tag" not in cols:
        # Existing DBs need alembic a9b0c1d2e3f4 before this query can run.
        return
    dirty = False
    for spec in DEFAULT_TEMPLATES:
        config = deepcopy(spec["config"])
        existing = AnalysisTemplate.query.filter_by(
            name=spec["name"], is_default=True
        ).first()
        if existing:
            if existing.config == config and existing.description == spec["description"]:
                continue
            existing.description = spec["description"]
            existing.profile_risk_tag = spec["profile_risk_tag"]
            existing.equations = config["radar"]["equations"]
            existing.config = config
            dirty = True
            continue
        db.session.add(AnalysisTemplate(
            name=spec["name"],
            description=spec["description"],
            creator_id=None,
            is_default=True,
            profile_risk_tag=spec["profile_risk_tag"],
            equations=config["radar"]["equations"],
            config=config,
        ))
        dirty = True
    if dirty:
        db.session.commit()


def default_for_risk_tag(risk_tag=None):
    """DB row for the matching default. Seeds first so lookup always works."""
    seed_default_templates()
    tag = risk_tag if risk_tag in {"Conservative", "Balanced", "Growth", "Aggressive"} else "Balanced"
    row = AnalysisTemplate.query.filter_by(is_default=True, profile_risk_tag=tag).first()
    if row is None:
        row = AnalysisTemplate.query.filter_by(is_default=True, profile_risk_tag="Balanced").first()
    return row
