from asteval import Interpreter
from app.models import MarketStats
from app.utils.normalization import (
    calculate_z_score, calculate_min_max, calculate_group_stats, calculate_pct_rank,
    scope_population, MIN_SCOPE_POPULATION,
)
from app.constants import RADAR_METRICS

def _to_python_math(equation_string):
    """
    Translate the formula editor's syntax into Python's.

    The editor previews formulas with mathjs, where `^` is exponentiation. Python
    reads `^` as bitwise XOR, which raises on floats -- so `roe ^ 2` used to
    preview a perfectly good number and then score the axis 0.0 forever. Accept
    the syntax the editor taught the user, and keep `**` working for anyone who
    types it. Equations are arithmetic only, so there are no string literals a
    naive replace could damage.
    """
    return equation_string.replace('**', '^').replace('^', '**')


def evaluate_equations(template_equations, variables_dict):
    """
    Safely evaluates a dictionary of math equations using the provided variables.
    
    Args:
        template_equations: dict of {"Category Name": "math string"}
                            e.g. {"Valuation": "n_pe * 0.4 + n_roe * 0.6"}
        variables_dict: dict of available variables for the math string
                        e.g. {"n_pe": 0.8, "n_roe": 0.2}

    Every equation is expected to land in 0.0 - 1.0; the result is simply scaled
    to 0 - 100. Plain metric names are already percentile ranks, so an ordinary
    weighted average satisfies that without the author thinking about it. A
    formula reaching for z_ values re-centres them itself, e.g. (z_roe + 3) / 6.

    Returns:
        dict of calculated scores: {"Valuation": 85.2, ...}
    """

    # Create a secure sandbox interpreter
    # Disable built-ins to prevent malicious code execution
    aeval = Interpreter(use_numpy=False, builtins_readonly=True)

    for var_name, var_value in variables_dict.items():
        aeval.symtable[var_name] = var_value

    results = {}

    for category, equation_string in template_equations.items():
        try:
            # Evaluate math string
            score = aeval(_to_python_math(equation_string))


            # If syntax is bad, aeval return None and populates aeval.errors
            if len(aeval.error) > 0:
                print(f"Error evaluating '{equation_string}': {aeval.error}")
                results[category] = 0.0
                aeval.error = []
            else:
                raw_score = float(score) if score is not None else 0.0
                results[category] = max(0.0, min(100.0, raw_score * 100.0))
        except Exception as e:
            print(f"Exception evaluating '{equation_string}': {e}")
            results[category] = 0.0
    return results

def calculate_single_stock_scores(stock, template_payload):
    """
    Uses pre-calculated database stats to normalize a single stock's metrics,
    and then evaluates the custom equation template.
    """
    template_equations = template_payload.get('equations', {})
    scope_type = template_payload.get('scope', 'global')

    # 1. Fetch the stats context from the DB, falling back to global whenever the
    #    requested scope cannot support a ranking: the stock has no sector or
    #    industry set, that scope was never computed, or it holds too few peers.
    #    Without the fallback those stocks scored 0.0 on every axis.
    stats_dict = _resolve_scope_stats(stock, scope_type)
    if stats_dict is None:
        print("Warning: No global MarketStats found. Scores will be 0.")
        return {cat: 0.0 for cat in template_equations.keys()}
    
    # 2. Build the normalization variable dictionary
    normalized_vars = extract_and_normalize_metrics(stock, stats_dict)
    
    # 3. Evaluate
    return evaluate_equations(template_equations, normalized_vars)

def _resolve_scope_stats(stock, scope_type):
    """Stats blob to grade `stock` against, degrading to global when the narrow scope is unusable."""
    scope_name = None
    if scope_type == 'sector':
        scope_name = stock.sector
    elif scope_type == 'industry':
        scope_name = stock.industry

    if scope_name:
        record = MarketStats.query.filter_by(
            scope_type=scope_type, scope_name=scope_name
        ).first()
        if record and scope_population(record.stats_data) >= MIN_SCOPE_POPULATION:
            return record.stats_data

    fallback = MarketStats.query.filter_by(scope_type='global', scope_name='All').first()
    return fallback.stats_data if fallback else None


def calculate_compare_scores(stocks, template_payload, is_relative=False):
    """
    If is_relative is True: Runs the Cage Match (grades stocks ONLY against each other).
    If False: Runs the Scope-based math (grades against the DB Global/Sector/Industry).
    """
    if is_relative:
        # THE CAGE MATCH (Relative to selection only)
        template_equations = template_payload.get('equations', {})
        
        dynamic_stats = {}
        for field in RADAR_METRICS:
            values = [getattr(s, field) for s in stocks if getattr(s, field) is not None]
            dynamic_stats[field] = calculate_group_stats(values)
            
        results = {}
        for stock in stocks:
            normalized_vars = extract_and_normalize_metrics(stock, dynamic_stats)
            scores = evaluate_equations(template_equations, normalized_vars)
            results[stock.symbol] = scores
        return results
        
    else:
        # THE SCOPE MATCH (Table charts via DB)
        results = {}
        for stock in stocks:
            results[stock.symbol] = calculate_single_stock_scores(stock, template_payload)
        return results

def extract_and_normalize_metrics(stock, stats_dict):
    """
    Map a stock's raw attributes into the math variables a formula can use.

    Each metric is offered three ways. The bare name (`roe`) is the percentile
    rank, which is what the built-in templates and any hand-written weighted
    average want. `z_roe` and `mm_roe` are there for the rare formula that needs
    distance-from-average or raw min-max instead.
    """
    vars_dict = {}
    
    # Helper to safely grab the raw value
    def get_val(field):
        val = getattr(stock, field, None)
        return float(val) if val is not None else None
        
    for field, stats in stats_dict.items():
        raw_val = get_val(field)
        
        # Every field is offered in all three normalizations so a formula can pick.
        z_score = calculate_z_score(raw_val, stats.get('mean'), stats.get('std'))
        min_max = calculate_min_max(raw_val, stats.get('min'), stats.get('max'))
        pct_rank = calculate_pct_rank(raw_val, stats.get('quantiles'))
        
        vars_dict[f"z_{field}"] = z_score
        vars_dict[f"mm_{field}"] = min_max
        vars_dict[f"pct_{field}"] = pct_rank

        # The bare name is the percentile rank: uniform 0-1, outlier-proof, and
        # 0.5 when the metric is missing. `pct_roe` is an explicit alias for it.
        vars_dict[field] = pct_rank
        
    return vars_dict