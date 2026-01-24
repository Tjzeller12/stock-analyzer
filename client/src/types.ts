import { RadarChartData } from "./components/common/RadarGraph";

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  industry: number; // Enum or string in future?
  ev_to_ebita: number;
  pe_ratio: number;
  market_cap: number;
  dividend_yield: number;
  buy_rating: number;
  hold_rating: number;
  sell_rating: number;
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
  radarChartData: RadarChartData;
}

