from app import db
from app.models import StockMaster, MarketStats
import numpy as np 
import datetime
from app.constants import RADAR_METRICS

def calculate_and_save_stats(scope_type, scope_name, stock_query):
    """
    Given a SQLAlchemy query of stocks, calculates min/max/mean/std for all numerical fields
    and saves it to the MarketStats table.
    """
    metrics = RADAR_METRICS

    stocks = stock_query.all()
    if not stocks:
        print("Stock query was empty, cannot calculate stats.")
        return

    stats_data = {}

    for metric in metrics:
        # Extract values for this metric
        values = [getattr(s, metric) for s in stocks if getattr(s, metric) is not None]
        if len(values) > 0:
            stats_data[metric] = {
                "mean": float(np.mean(values)),
                "std": float(np.std(values)),
                "min": float(np.min(values)),
                "max": float(np.max(values)),
                "quantiles": _quantile_grid(values),
                "count": len(values)
            }
        else:
            stats_data[metric] = {
                "mean": 0,
                "std": 0,
                "min": 0,
                "max": 0,
                "quantiles": [],
                "count": 0
            }

    # Find or create a new stat record. Older rows could duplicate a scope, and
    # .first() would then pick a snapshot arbitrarily -- collapse them here.
    records = MarketStats.query.filter_by(scope_type=scope_type, scope_name=scope_name).all()
    stat_record = records[0] if records else None
    for extra in records[1:]:
        db.session.delete(extra)
    if not stat_record:
        stat_record = MarketStats(scope_type=scope_type, scope_name=scope_name)
        db.session.add(stat_record)

    stat_record.stats_data = stats_data
    stat_record.last_updated = datetime.datetime.utcnow()
    db.session.commit()

def update_global_and_sector_stats(sector=None, industry=None):
    """
    Recalculates stats. If sector/industry are provided, it only updates those specific ones
    alongside the global stats to save time.
    """
    from app.constants import GLOBAL, SECTOR, INDUSTRY
    
    # 1. Update Global (All stocks)
    calculate_and_save_stats(GLOBAL, 'All', StockMaster.query)
    
    # 2. Update Specific Sector
    if sector:
        calculate_and_save_stats(SECTOR, sector, StockMaster.query.filter_by(sector=sector))
        
    # 3. Update Specific Industry
    if industry:
        calculate_and_save_stats(INDUSTRY, industry, StockMaster.query.filter_by(industry=industry))


# --- Equation Scoring Math Utilities ---

# 21 breakpoints = every 5th percentile. Enough resolution to rank a stock
# within ~2.5 points, small enough to keep MarketStats.stats_data compact.
PCT_GRID_STEPS = 21
NEUTRAL_PCT = 0.5

# Below this many stocks a scope cannot support a meaningful ranking -- with two
# peers every stock is either the best or the worst. Callers fall back to global.
MIN_SCOPE_POPULATION = 5


def scope_population(stats_dict):
    """Largest per-metric sample size in a stats blob, i.e. how many stocks it covers."""
    if not stats_dict:
        return 0
    return max((s.get("count", 0) or 0) for s in stats_dict.values() if isinstance(s, dict))


def _quantile_grid(values):
    """Evenly spaced quantiles of `values`, used later to rank a stock against the scope."""
    if not values:
        return []
    qs = np.linspace(0.0, 100.0, PCT_GRID_STEPS)
    return [float(v) for v in np.percentile(values, qs)]


def calculate_pct_rank(value, quantiles):
    """
    Percentile rank of `value` within a scope, as 0.0-1.0.

    Unlike min-max this is uniform by construction, so a single outlier cannot
    compress the rest of the universe into a corner. Missing values return the
    median (0.5) rather than 0.0, so an absent metric reads as "average" instead
    of "worst in universe" -- or, once inverted with (1 - pct_x), "best".
    """
    if value is None or not quantiles:
        return NEUTRAL_PCT
    n = len(quantiles)
    if quantiles[0] == quantiles[-1]:
        # Degenerate scope: every stock shares one value (an unpopulated column
        # such as roic, or a single-stock sector). Rank is meaningless, so stay
        # neutral instead of scoring the whole universe at the floor.
        return NEUTRAL_PCT

    step = 1.0 / (n - 1)

    # Ties take the middle of the band they share rather than its bottom edge.
    # Metrics like ai_moat_score are small integers, so without this every stock
    # on the most common value would be ranked as if it were the worst of them.
    tied = [i for i, q in enumerate(quantiles) if q == value]
    if tied:
        return (tied[0] + tied[-1]) / 2.0 * step

    if value < quantiles[0]:
        return 0.0
    if value > quantiles[-1]:
        return 1.0
    for i in range(n - 1):
        lo, hi = quantiles[i], quantiles[i + 1]
        if lo < value < hi:
            return (i + (value - lo) / (hi - lo)) * step
    return NEUTRAL_PCT


def calculate_z_score(value, mean, std):
    """
    Calculate the Z-Score.
    Returns 0 if std is 0 or value is None.
    """
    if value is None or mean is None or std is None or std == 0:
        return 0.0
    return (value - mean) / std

def calculate_min_max(value, min_val, max_val):
    """
    Calculates the Min-Max scaled value (0.0 to 1.0).
    Returns 0.0 if min == max or value is None.
    """
    if value is None or min_val is None or max_val is None or max_val == min_val:
        return 0.0
    return (value - min_val) / (max_val - min_val)

def calculate_group_stats(values):
    """
    Takes an array of values (e.g. all P/E ratios for a list of stocks)
    and returns a localized stats dictionary.
    Used for the custom "Compare Mode".
    """
    # Filter out None values
    valid_values = [v for v in values if v is not None]
    
    if not valid_values:
        return {"mean": 0, "std": 0, "min": 0, "max": 0, "quantiles": [], "count": 0}
        
    return {
        "mean": float(np.mean(valid_values)),
        "std": float(np.std(valid_values)),
        "min": float(np.min(valid_values)),
        "max": float(np.max(valid_values)),
        "quantiles": _quantile_grid(valid_values),
        "count": len(valid_values)
    }