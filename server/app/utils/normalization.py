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
                "max": float(np.max(values))
            }
        else:
            stats_data[metric] = {
                "mean": 0,
                "std": 0,
                "min": 0,
                "max": 0
            }

    # Find or create a new stat record
    stat_record = MarketStats.query.filter_by(scope_type=scope_type, scope_name=scope_name).first()
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
        return {"mean": 0, "std": 0, "min": 0, "max": 0}
        
    return {
        "mean": float(np.mean(valid_values)),
        "std": float(np.std(valid_values)),
        "min": float(np.min(valid_values)),
        "max": float(np.max(valid_values))
    }