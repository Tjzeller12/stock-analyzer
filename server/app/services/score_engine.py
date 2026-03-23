from asteval import Interpreter
from app.models import MarketStats
from app.utils.normalization import calculate_z_score, calculate_min_max, calculate_group_stats
from app.constants import RADAR_METRICS

def evaluate_equations(template_equations, variables_dict, normalization_method='min-max'):
    """
    Safely evaluates a dictionary of math equations using the provided variables.
    
    Args:
        template_equations: dict of {"Category Name": "math string"}
                            e.g. {"Valuation": "n_pe * 0.4 + n_roe * 0.6"}
        variables_dict: dict of available variables for the math string
                        e.g. {"n_pe": 0.8, "n_roe": 0.2}
                        
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
            score = aeval(equation_string)


            # If syntax is bad, aeval return None and populates aeval.errors
            if len(aeval.error) > 0:
                print(f"Error evaluating '{equation_string}': {aeval.error}")
                results[category] = 0.0
                aeval.error = []
            else:
                raw_score = float(score) if score is not None else 0.0
                # min max score scaling for 0 - 100
                if normalization_method == 'min-max':
                    final_score = raw_score * 100.0
                else:
                    # Z-score scaling for 0 - 100
                    final_score = (raw_score + 3.0) * 16.67
                results[category] = max(0.0, min(100.0, final_score))
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
    norm_method = template_payload.get('normalization_method', 'min-max')
    scope_type = template_payload.get('scope', 'global')
    # 1. Fetch the stats context from the DB
    scope_name = 'All'
    if scope_type == 'sector' and stock.sector:
        scope_name = stock.sector
    elif scope_type == 'industry' and stock.industry:
        scope_name = stock.industry
        
    stats_record = MarketStats.query.filter_by(scope_type=scope_type, scope_name=scope_name).first()
    
    if not stats_record:
        print(f"Warning: No MarketStats found for {scope_type}:{scope_name}. Scores will be 0.")
        return {cat: 0.0 for cat in template_equations.keys()}
        
    stats_dict = stats_record.stats_data
    
    # 2. Build the normalization variable dictionary
    normalized_vars = extract_and_normalize_metrics(stock, stats_dict, norm_method)
    
    # 3. Evaluate
    return evaluate_equations(template_equations, normalized_vars, norm_method)

def calculate_compare_scores(stocks, template_payload, is_relative=False):
    """
    If is_relative is True: Runs the Cage Match (grades stocks ONLY against each other).
    If False: Runs the Scope-based math (grades against the DB Global/Sector/Industry).
    """
    if is_relative:
        # THE CAGE MATCH (Relative to selection only)
        template_equations = template_payload.get('equations', {})
        norm_method = template_payload.get('normalization_method', 'min-max')
        
        dynamic_stats = {}
        for field in RADAR_METRICS:
            values = [getattr(s, field) for s in stocks if getattr(s, field) is not None]
            dynamic_stats[field] = calculate_group_stats(values)
            
        results = {}
        for stock in stocks:
            normalized_vars = extract_and_normalize_metrics(stock, dynamic_stats, norm_method)
            scores = evaluate_equations(template_equations, normalized_vars, norm_method)
            results[stock.symbol] = scores
        return results
        
    else:
        # THE SCOPE MATCH (Table charts via DB)
        results = {}
        for stock in stocks:
            results[stock.symbol] = calculate_single_stock_scores(stock, template_payload)
        return results

def extract_and_normalize_metrics(stock, stats_dict, normalization_method='min-max'):
    """Helper function to map a stock's raw attributes into 'z_' and 'mm_' math variables"""
    vars_dict = {}
    
    # Helper to safely grab the raw value
    def get_val(field):
        val = getattr(stock, field, None)
        return float(val) if val is not None else None
        
    for field, stats in stats_dict.items():
        raw_val = get_val(field)
        
        # We provide BOTH a Z-Score and a Min-Max so the user can choose in their formula
        z_score = calculate_z_score(raw_val, stats.get('mean'), stats.get('std'))
        min_max = calculate_min_max(raw_val, stats.get('min'), stats.get('max'))
        
        # For our formula builder, we'll prefix them so the user has e.g. "z_pe_ratio" or "mm_pe_ratio"
        vars_dict[f"z_{field}"] = z_score
        vars_dict[f"mm_{field}"] = min_max

        # Assign ONLY the requested one to the clean variable name (e.g., "pe_ratio")
        if normalization_method == 'z-score':
            vars_dict[field] = z_score if z_score is not None else 0.0
        else:
            vars_dict[field] = min_max if min_max is not None else 0.0
        
    return vars_dict