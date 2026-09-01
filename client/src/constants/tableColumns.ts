import { Stock } from "../types";

export type ColumnGroup =
  | "Identity"
  | "Valuation"
  | "Profitability"
  | "Growth"
  | "Cash Flow"
  | "Balance Sheet"
  | "Risk"
  | "AI";

export type ColumnFormat =
  | "currency"
  | "bigNumber"
  | "percent"
  | "signedPercent"
  | "ratio"
  | "integer"
  | "text"
  | "volume";

export interface ColumnSpec {
  id: string;
  header: string;
  field: keyof Stock;
  group: ColumnGroup;
  format: ColumnFormat;
  removable: boolean;
  defaultVisible: boolean;
  width?: number;
  digits?: number;
  tooltipField?: keyof Stock;
  headerClass?: string;
  /** Green/red like portfolio P/L (used for daily change). */
  tone?: "pnl";
}

/**
 * Toggleable metric columns.
 *
 * defaultVisible = the common glance set (quote + a few health checks).
 * Specialist columns stay in the picker for later; feature 08 saves the
 * user's visible set with each analysis template.
 */
export const COLUMN_REGISTRY: ColumnSpec[] = [
  { id: "name", header: "Name", field: "name", group: "Identity", format: "text", removable: true, defaultVisible: true, width: 200 },
  { id: "price", header: "Price", field: "price", group: "Identity", format: "currency", removable: true, defaultVisible: true, width: 100 },
  { id: "price_change_percent", header: "Change %", field: "price_change_percent", group: "Identity", format: "signedPercent", removable: true, defaultVisible: true, width: 110, tone: "pnl" },
  { id: "market_cap", header: "Market Cap", field: "market_cap", group: "Valuation", format: "bigNumber", removable: true, defaultVisible: true, width: 150 },
  { id: "volume", header: "Volume", field: "volume", group: "Identity", format: "bigNumber", removable: true, defaultVisible: true, width: 120 },
  { id: "pe_ratio", header: "P/E", field: "pe_ratio", group: "Valuation", format: "ratio", removable: true, defaultVisible: true, width: 100, digits: 2 },
  { id: "forward_pe", header: "Fwd P/E", field: "forward_pe", group: "Valuation", format: "ratio", removable: true, defaultVisible: false, width: 120, digits: 2 },
  { id: "dividend_yield", header: "Div Yield", field: "dividend_yield", group: "Valuation", format: "percent", removable: true, defaultVisible: true, width: 110 },
  { id: "ev_to_ebitda", header: "EV/EBITDA", field: "ev_to_ebitda", group: "Valuation", format: "ratio", removable: true, defaultVisible: false, width: 120, digits: 2 },
  { id: "price_to_sales", header: "P/S", field: "price_to_sales", group: "Valuation", format: "ratio", removable: true, defaultVisible: false, width: 100, digits: 2 },
  { id: "peg_ratio", header: "PEG", field: "peg_ratio", group: "Valuation", format: "ratio", removable: true, defaultVisible: false, width: 100, digits: 3 },
  { id: "roe", header: "ROE", field: "roe", group: "Profitability", format: "percent", removable: true, defaultVisible: true, width: 100 },
  { id: "operating_margin", header: "Op Margin", field: "operating_margin", group: "Profitability", format: "percent", removable: true, defaultVisible: false, width: 120 },
  { id: "profit_margin", header: "Profit Margin", field: "profit_margin", group: "Profitability", format: "percent", removable: true, defaultVisible: false, width: 140 },
  { id: "roa", header: "ROA", field: "roa", group: "Profitability", format: "percent", removable: true, defaultVisible: false, width: 100 },
  { id: "rev_growth_qoq", header: "Rev Growth (QoQ)", field: "rev_growth_qoq", group: "Growth", format: "percent", removable: true, defaultVisible: true, width: 160 },
  { id: "eps_growth_qoq", header: "EPS Growth (QoQ)", field: "eps_growth_qoq", group: "Growth", format: "percent", removable: true, defaultVisible: false, width: 160 },
  { id: "total_assets", header: "Total Assets", field: "total_assets", group: "Balance Sheet", format: "bigNumber", removable: true, defaultVisible: false, width: 140 },
  { id: "total_liabilities", header: "Total Liab.", field: "total_liabilities", group: "Balance Sheet", format: "bigNumber", removable: true, defaultVisible: false, width: 140 },
  { id: "operating_cash_flow", header: "Op. Cash Flow", field: "operating_cash_flow", group: "Cash Flow", format: "bigNumber", removable: true, defaultVisible: false, width: 140 },
  { id: "capital_expenditures", header: "CapEx", field: "capital_expenditures", group: "Cash Flow", format: "bigNumber", removable: true, defaultVisible: false, width: 120 },
  { id: "free_cash_flow", header: "Free Cash Flow", field: "free_cash_flow", group: "Cash Flow", format: "bigNumber", removable: true, defaultVisible: false, width: 150 },
  { id: "debt_to_equity", header: "Debt/Equity", field: "debt_to_equity", group: "Risk", format: "ratio", removable: true, defaultVisible: true, width: 130, digits: 2 },
  { id: "beta", header: "Beta", field: "beta", group: "Risk", format: "ratio", removable: true, defaultVisible: true, width: 100, digits: 3 },
  { id: "buy_ratings_count", header: "Buy Ratings", field: "buy_ratings_count", group: "Risk", format: "integer", removable: true, defaultVisible: false, width: 130 },
  { id: "insider_volume", header: "Insider Vol", field: "insider_volume", group: "Risk", format: "volume", removable: true, defaultVisible: false, width: 130 },
  {
    id: "ai_moat_score",
    header: "AI Moat",
    field: "ai_moat_score",
    group: "AI",
    format: "integer",
    removable: true,
    defaultVisible: true,
    width: 110,
    tooltipField: "ai_moat_summary",
    headerClass: "ai-header-glow",
  },
  {
    id: "ai_news_score",
    header: "AI News",
    field: "ai_news_score",
    group: "AI",
    format: "integer",
    removable: true,
    defaultVisible: true,
    width: 110,
    tooltipField: "ai_news_summary",
    headerClass: "ai-header-glow",
  },
];

export const DEFAULT_VISIBLE_COLUMNS = COLUMN_REGISTRY.filter((c) => c.defaultVisible).map((c) => c.id);

export const COLUMN_GROUPS: ColumnGroup[] = [
  "Identity",
  "Valuation",
  "Profitability",
  "Growth",
  "Cash Flow",
  "Balance Sheet",
  "Risk",
  "AI",
];

export const TABLE_PREFS_KEY = "alphabot.tablePrefs.v3";
