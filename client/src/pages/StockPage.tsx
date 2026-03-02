/**
 * StockPage component
 * Detailed view for a specific stock, displaying metrics, charts, news sentiment, and AI analysis.
 * Uses StockHeader and StockMetricsTable extracted components.
 */
import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import { ALPHA_BOT_ENDPOINTS, DATA_ENDPOINTS } from '../constants/api';
import "../main.css";
import { authPost } from '../utils/api';
import "./StockPage.css";
import logo from "../resources/Stock_Market_Logo.png";
import StockHeader from "../components/StockHeader";
import StockMetricsTable from "../components/StockMetricsTable";

interface Sentiment {
  positive: number;
  neutral: number;
  negative: number;
}

interface Stock {
  symbol: string;
  name: string;
  price: number;
  industry: number;
  ev_to_ebita: number;
  pe_ratio: number;
  market_cap: number;
  dividend_yield: number;
  buy_rating: number;
  hold_rating: number;
  sell_rating: number;
  news_summary: string;
  news_sentiment: Sentiment;
  free_cash_flow: number;
  debt_to_equity: number;
  roic: number;
  price_to_fc: number;
  cashAndCashEquivalents: number;
  article_sentiment_positive: number;
  article_sentiment_neutral: number;
  article_sentiment_negative: number;
}

const StockPage: React.FC = () => {
  const navigate = useNavigate();
  const { symbol } = useParams<{ symbol: string }>();
  const [stock, setStock] = useState<Stock | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [queryResult] = useState<string | null>(null);
  const [, setLoading] = useState(false);
  const [llmPrompt, setLlmPrompt] = useState("");

  const fetchStock = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const stockData = await authPost<Stock>(DATA_ENDPOINTS.STOCK, { symbol });
      setStock(stockData);
    } catch (error) {
      console.error("Stock fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlphaBotInDepthAnalysis = async () => {
    if (!symbol) return;
    try {
      const response = await authPost<{ response: string }>(ALPHA_BOT_ENDPOINTS.IN_DEPTH, { stock_symbol: symbol });
      if (response.response) {
        setSummary(response.response);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const fetchInDepthData = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const inDepthData = await authPost<Stock>(DATA_ENDPOINTS.IN_DEPTH, { symbol });
      setStock(inDepthData);
    } catch (error) {
      console.error("In-depth data fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStock();
    void fetchInDepthData();
    void fetchAlphaBotInDepthAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const handleLogoClick = () => {
    navigate("/main");
  };

  return (
    <div className="stock-container">
      <StockHeader stock={stock} onLogoClick={handleLogoClick} logo={logo} />

      <StockMetricsTable stock={stock} />

      <div className="stock-graph-llm-container">
        <div className="stock-in-depth-analysis-container">
          <div className="stock-llm-header">
            <span className="stock-llm-header-label">In Depth Analysis</span>
          </div>
          <div className="analysis-container">
            {summary ? <Markdown>{summary}</Markdown> : "Loading analysis..."}
          </div>
        </div>
        <div className="stock-llm-container">
          <div className="stock-llm-header">
            <span className="stock-llm-header-label">Alpha Bot Summary</span>
          </div>
          <div className="stock-llm-text">
            <div>{queryResult || "Loading response..."}</div>
          </div>
          <div className="prompt-container">
            <input
              type="text"
              placeholder="Ask about this stock..."
              className="prompt-input"
              value={llmPrompt}
              onChange={(e) => setLlmPrompt(e.target.value)}
            />
          </div>
          {stock?.news_sentiment && (
            <div className="stock-llm-summary-sentiment">
              <div>
                Positive: {(stock.news_sentiment.positive * 100).toFixed(1)}%
              </div>
              <div>
                Neutral: {(stock.news_sentiment.neutral * 100).toFixed(1)}%
              </div>
              <div>
                Negative: {(stock.news_sentiment.negative * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockPage;
