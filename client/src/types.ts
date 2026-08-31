export interface Sentiment {
  positive: number;
  neutral: number;
  negative: number;
}

export interface CompanyOverview {
  Symbol?: string;
  Name?: string;
  Description?: string;
  Sector?: string;
  Industry?: string;
  MarketCapitalization?: string;
  EBITDA?: string;
  PERatio?: string;
  PEGRatio?: string;
  BookValue?: string;
  DividendPerShare?: string;
  DividendYield?: string;
  EPS?: string;
  TrailingPE?: string;
  ForwardPE?: string;
  PriceToSalesRatioTTM?: string;
  PriceToBookRatio?: string;
  EVToRevenue?: string;
  EVToEBITDA?: string;
  Beta?: string;
  "52WeekHigh"?: string;
  "52WeekLow"?: string;
  "50DayMovingAverage"?: string;
  "200DayMovingAverage"?: string;
  SharesOutstanding?: string;
  DividendDate?: string;
  ExDividendDate?: string;
  ProfitMargin?: string;
  OperatingMarginTTM?: string;
  ReturnOnAssetsTTM?: string;
  ReturnOnEquityTTM?: string;
  RevenueTTM?: string;
  GrossProfitTTM?: string;
  DilutedEPSTTM?: string;
  QuarterlyEarningsGrowthYOY?: string;
  QuarterlyRevenueGrowthYOY?: string;
  AnalystTargetPrice?: string;
  AnalystRatingStrongBuy?: string;
  AnalystRatingBuy?: string;
  AnalystRatingHold?: string;
  AnalystRatingSell?: string;
  AnalystRatingStrongSell?: string;
}

export interface GlobalQuote {
  "Global Quote"?: {
    "01. symbol"?: string;
    "02. open"?: string;
    "03. high"?: string;
    "04. low"?: string;
    "05. price"?: string;
    "06. volume"?: string;
    "07. latest trading day"?: string;
    "08. previous close"?: string;
    "09. change"?: string;
    "10. change percent"?: string;
  };
}

export interface NewsSentimentData {
  items?: string;
  sentiment_score_definition?: string;
  relevance_score_definition?: string;
  feed?: Array<{
    title: string;
    url: string;
    time_published: string;
    authors: string[];
    summary: string;
    banner_image: string;
    source: string;
    category_within_source: string;
    source_domain: string;
    topics: Array<{
      topic: string;
      relevance_score: string;
    }>;
    overall_sentiment_score: number;
    overall_sentiment_label: string;
    ticker_sentiment: Array<{
      ticker: string;
      relevance_score: string;
      ticker_sentiment_score: string;
      ticker_sentiment_label: string;
    }>;
  }>;
}
export interface TimeSeriesMonthly {
  "Meta Data"?: {
    "1. Information": string;
    "2. Symbol": string;
    "3. Last Refreshed": string;
    "4. Time Zone": string;
  };
  "Monthly Time Series"?: {
    [date: string]: {
      "1. open": string;
      "2. high": string;
      "3. low": string;
      "4. close": string;
      "5. volume": string;
    };
  };
}
export interface AlphaVantageData {
  news_sentiment_data?: NewsSentimentData;
}

export interface Stock extends AlphaVantageData {
  symbol: string;
  name?: string;
  sector?: string;
  industry?: string;
  price: number;
  price_change_percent?: number;
  volume?: number;
  market_cap?: number;
  pe_ratio?: number;
  forward_pe?: number;
  peg_ratio?: number;
  ev_to_ebitda?: number;
  price_to_sales?: number;
  price_to_book?: number;
  dividend_yield?: number;
  roe?: number;
  roa?: number;
  operating_margin?: number;
  profit_margin?: number;
  rev_growth_qoq?: number;
  eps_growth_qoq?: number;
  beta?: number;
  buy_ratings_count?: number;
  hold_ratings_count?: number;
  sell_ratings_count?: number;
  
  insider_volume?: number;
  ai_news_score?: number;
  ai_news_summary?: string;
  ai_moat_score?: number;
  ai_moat_summary?: string;
  last_stock_update?: string;
  last_fundamental_update?: string;
  income_statement?: Record<string, unknown>;
  cash_flow_history?: Record<string, unknown>;
  
  // Standard and Core Financials
  free_cash_flow?: number;
  operating_cash_flow?: number;
  capital_expenditures?: number;
  total_assets?: number;
  total_liabilities?: number;
  total_shareholder_equity?: number;
  net_income?: number;
  debt_to_equity?: number;
  roic?: number;
  price_to_fc?: number;
  cashAndCashEquivalents?: number;

  // Position fields — only populated for real brokerage holdings (feature 10).
  quantity?: number;
  avg_cost?: number;
  market_value?: number | null;
  cost_basis?: number;
  unrealized_pnl?: number | null;
  unrealized_pnl_pct?: number | null;
  current_price?: number | null;
}

export interface Article {
  image_link: string;
  link: string;
  title: string;
  news_company: string;
  time_published: string;
  summary: string;
}

export interface AlphaBotResponse {
  response: string;
}

// Used for after alpha bot response is parsed
export interface CompareResponse {
  analysis: string;
  doughnutChartData: ChartData;
}

export interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor?: string | string[];
        borderColor?: string | string[];
        borderWidth?: number;
        fill?: boolean;
    }[];
}

// --- Investor profile (mirrors server InvestorProfile.to_dict()) ---
export type RiskTag = "Conservative" | "Balanced" | "Growth" | "Aggressive";
export type HorizonTag = "Short" | "Medium" | "Long" | "Very Long"; // <2y / 2-5y / 5-10y / 10y+
export type BudgetBand = "micro" | "standard" | "high";

export interface InvestorProfile {
  risk_tolerance_score: number;        // 0-100, deterministic
  risk_tag: RiskTag | null;
  time_horizon_years: number | null;   // raw answer, e.g. 12
  horizon_tag: HorizonTag | null;
  budget: number;                      // USD, >= 0
  preferred_sectors: string[];         // <= 3 canonical sector keys
  onboarding_completed: boolean;
  updated_at: string | null;           // ISO 8601
}

// --- Questionnaire config (static, drives the UI generically) ---
export type ScoringDimension = "risk" | "horizon";

export interface AnswerOption {
  id: string;                          // stable key, persisted in raw answers
  label: string;                       // e.g. "Buy more - it's on sale"
  /** Points contributed per dimension when this option is chosen. */
  weights: Partial<Record<ScoringDimension, number>>;
}

export interface ScenarioQuestion {
  id: string;                          // stable key, e.g. "q_market_crash"
  prompt: string;                      // scenario text
  helper?: string;                     // optional sub-text
  options: AnswerOption[];             // single-select
  dimension: ScoringDimension;         // which axis this question scores
}

export interface SectorInfo {
  key: string;                         // canonical key matching StockMaster.sector
  label: string;                       // display name, e.g. "Technology"
  icon?: string;                       // optional emoji/asset id
  pitch: string[];                     // Pros - bullet points
  realityCheck: string[];              // Cons - bullet points
}

// --- The mutable draft held during onboarding ---
export interface OnboardingDraft {
  version: 1;
  answers: Record<string, string>;     // questionId -> selected optionId
  timeHorizonYears: number | null;
  budget: number | null;
  selectedSectors: string[];           // ordered, <= 3
  stepIndex: number;                   // for resume
}

// --- Brokerage import (feature 10) ---
// A real brokerage holding: full stock data (so it renders in the same table +
// radar as the watchlist) plus broker-provided position fields.
export interface PortfolioHolding extends Stock {
  quantity: number;
  avg_cost: number;
  market_value: number | null;
  cost_basis: number;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  current_price: number | null;
}

export interface PerformanceSummary {
  total_value: number;
  total_cost_basis: number;
  total_return: number;
  total_return_pct: number;
  last_synced: string | null;
}

export interface BrokerageConnectionStatus {
  connected: boolean;
  brokerage_name?: string | null;
  last_synced?: string | null;
}

export interface BrokerageHoldingsResponse {
  status: BrokerageConnectionStatus;
  holdings: PortfolioHolding[];
  performance: PerformanceSummary;
}

// --- Discovery engine (feature 02) ---
export interface DiscoveryRecommendation {
  ticker: string;                      // uppercased, validated
  company_name: string;
  rationale: string;                   // <= 2 sentences (bounded server-side)
  sector?: string | null;              // optional, if Claude supplies it
}

export interface DiscoverySession {
  refinements: string[];               // ordered, append-only, capped
}

export interface DiscoveryResponse {
  recommendations: DiscoveryRecommendation[];
  generated_from: {
    has_profile: boolean;              // false → generic fallback was used
    refinement_count: number;
  };
}
