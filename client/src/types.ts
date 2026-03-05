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
  company_overview?: CompanyOverview;
  global_quote?: GlobalQuote;
  time_series_monthly?: TimeSeriesMonthly;
  news_sentiment_data?: NewsSentimentData;
}

export interface Stock extends AlphaVantageData {
  symbol: string;
  name: string;
  price: number;
  
  insider_volume?: number;
  last_stock_update?: string;
  last_alpha_vantage_update?: string;
  income_statement?: Record<string, unknown>;
  cash_flow_history?: Record<string, unknown>;
  free_cash_flow?: number;
  debt_to_equity?: number;
  roic?: number;
  price_to_fc?: number;
  cashAndCashEquivalents?: number;
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
  radarChartData: ChartData;
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
