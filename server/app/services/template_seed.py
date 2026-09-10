"""
Four read-only starter templates, one per investor risk_tag.

These are the product defaults — not placeholders. Equations use real
StockMaster / RADAR_METRICS fields. seed_default_templates() is idempotent.
"""
from copy import deepcopy

from app import db
from app.models import AnalysisTemplate

QUOTE_COLUMNS = ["name", "price", "price_change_percent", "market_cap"]

CONSERVATIVE_COLUMNS = QUOTE_COLUMNS + [
    "dividend_yield", "pe_ratio", "debt_to_equity", "beta",
    "roe", "free_cash_flow", "profit_margin",
]
BALANCED_COLUMNS = QUOTE_COLUMNS + [
    "volume", "pe_ratio", "dividend_yield", "roe",
    "rev_growth_qoq", "debt_to_equity", "beta",
    "ai_moat_score", "ai_news_score",
]
GROWTH_COLUMNS = QUOTE_COLUMNS + [
    "rev_growth_qoq", "eps_growth_qoq", "peg_ratio", "price_to_sales",
    "roe", "free_cash_flow", "ai_moat_score",
]
AGGRESSIVE_COLUMNS = QUOTE_COLUMNS + [
    "rev_growth_qoq", "eps_growth_qoq", "peg_ratio", "beta",
    "ai_news_score", "ai_moat_score", "price_to_sales",
]

ALLOWED_COLUMN_IDS = {
    "name", "price", "price_change_percent", "market_cap", "volume",
    "pe_ratio", "forward_pe", "dividend_yield", "ev_to_ebitda",
    "price_to_sales", "peg_ratio", "roe", "operating_margin", "profit_margin",
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
            "For capital preservation. Favors cheap cash flow, low leverage, "
            "low beta, and a real dividend over growth stories."
        ),
        "config": {
            "radar": {
                "name": "Stability First",
                "normalization_method": "min-max",
                "scope": "global",
                "equations": {
                    "Valuation": "(1 - forward_pe) * 0.4 + (1 - ev_to_ebitda) * 0.3 + (1 - price_to_fc) * 0.3",
                    "Stability": "(1 - debt_to_equity) * 0.4 + (1 - beta) * 0.4 + dividend_yield * 0.2",
                    "Efficiency": "roe * 0.4 + roa * 0.3 + profit_margin * 0.3",
                    "Sentiment": "ai_moat_score * 0.7 + ai_news_score * 0.3",
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
                "normalization_method": "min-max",
                "scope": "global",
                "equations": {
                    "Valuation": "(1 - forward_pe) * 0.4 + (1 - ev_to_ebitda) * 0.3 + (1 - price_to_fc) * 0.3",
                    "Growth": "0.4 + (eps_growth_qoq * 0.3) + (rev_growth_qoq * 0.3)",
                    "Stability": "(1 - debt_to_equity) * 0.4 + (1 - beta) * 0.4 + dividend_yield * 0.2",
                    "Efficiency": "roe * 0.4 + roa * 0.3 + profit_margin * 0.3",
                    "Sentiment": "ai_moat_score * 0.6 + ai_news_score * 0.4",
                },
            },
            "visible_columns": BALANCED_COLUMNS,
        },
    },
    {
        "name": "Growth Tilt",
        "profile_risk_tag": "Growth",
        "description": (
            "Weights earnings and revenue growth plus reinvestment returns. "
            "Values names on PEG and sales, not deep-value multiples."
        ),
        "config": {
            "radar": {
                "name": "Growth Tilt",
                "normalization_method": "min-max",
                "scope": "global",
                "equations": {
                    "Growth": "0.3 + (eps_growth_qoq * 0.35) + (rev_growth_qoq * 0.35)",
                    "Efficiency": "roe * 0.4 + roa * 0.2 + roic * 0.4",
                    "Valuation": "(1 - peg_ratio) * 0.5 + (1 - price_to_sales) * 0.5",
                    "Sentiment": "ai_moat_score * 0.5 + ai_news_score * 0.5",
                },
            },
            "visible_columns": GROWTH_COLUMNS,
        },
    },
    {
        "name": "High Conviction Growth",
        "profile_risk_tag": "Aggressive",
        "description": (
            "Sector-relative growth and news momentum. Accepts higher beta "
            "for upside; weak on dividend and balance-sheet screens."
        ),
        "config": {
            "radar": {
                "name": "High Conviction Growth",
                "normalization_method": "z-score",
                "scope": "sector",
                "equations": {
                    "Growth": "0.2 + (eps_growth_qoq * 0.4) + (rev_growth_qoq * 0.4)",
                    "Efficiency": "roic * 0.5 + roe * 0.3 + profit_margin * 0.2",
                    "Momentum": "ai_news_score * 0.6 + (rev_growth_qoq * 0.4)",
                    "Sentiment": "ai_moat_score * 0.5 + ai_news_score * 0.5",
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
    """Insert each starter once. Never overwrites existing defaults."""
    from sqlalchemy import inspect

    inspector = inspect(db.engine)
    if "analysis_template" not in inspector.get_table_names():
        return
    cols = {c["name"] for c in inspector.get_columns("analysis_template")}
    if "config" not in cols or "profile_risk_tag" not in cols:
        # Existing DBs need alembic a9b0c1d2e3f4 before this query can run.
        return
    for spec in DEFAULT_TEMPLATES:
        existing = AnalysisTemplate.query.filter_by(
            name=spec["name"], is_default=True
        ).first()
        if existing:
            continue
        config = deepcopy(spec["config"])
        db.session.add(AnalysisTemplate(
            name=spec["name"],
            description=spec["description"],
            creator_id=None,
            is_default=True,
            profile_risk_tag=spec["profile_risk_tag"],
            equations=config["radar"]["equations"],
            config=config,
        ))
    db.session.commit()


def default_for_risk_tag(risk_tag=None):
    """DB row for the matching starter. Seeds first so lookup always works."""
    seed_default_templates()
    tag = risk_tag if risk_tag in {"Conservative", "Balanced", "Growth", "Aggressive"} else "Balanced"
    row = AnalysisTemplate.query.filter_by(is_default=True, profile_risk_tag=tag).first()
    if row is None:
        row = AnalysisTemplate.query.filter_by(is_default=True, profile_risk_tag="Balanced").first()
    return row
