export const AVAILABLE_VARIABLES = [
  'price', 'market_cap', 'total_assets', 'total_liabilities', 
  'operating_cash_flow', 'capital_expenditures', 'free_cash_flow', 'buy_ratings_count',
  'pe_ratio', 'forward_pe', 'peg_ratio', 'ev_to_ebitda', 'price_to_sales', 
  'price_to_book', 'price_to_fc', 'dividend_yield', 'roe', 'roa', 
  'operating_margin', 'profit_margin', 'roic', 'rev_growth_qoq', 
  'eps_growth_qoq', 'debt_to_equity', 'beta', 'insider_volume',
  'ai_news_score', 'ai_moat_score'
];

/**
 * Scale prefixes a formula can apply to any variable above.
 * An unprefixed name is already the percentile rank, so `pct_` is just an
 * explicit alias for the default. The others exist for the rarer formula that
 * needs distance-from-average rather than rank.
 */
export const VARIABLE_PREFIXES = [
  { prefix: 'pct_', label: 'Percentile rank, 0-1. Same as using the bare name.' },
  { prefix: 'z_', label: 'Standard deviations from the group average. Keeps the size of a gap, not just its order.' },
  { prefix: 'mm_', label: 'Raw min-max, 0-1. One extreme company squashes everyone else, so prefer pct_.' },
];

