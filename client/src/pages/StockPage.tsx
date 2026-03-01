/**
 * StockPage component
 * Detailed view for a specific stock, displaying metrics, charts, news sentiment, and AI analysis.
 */
import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import { ALPHA_BOT_ENDPOINTS, DATA_ENDPOINTS } from '../constants/api';
import "../main.css";
import { authPost } from '../utils/api';
import { formatCashAndCashEquivalents, formatDebtToEquity, formatFreeCashFlow, formatMarketCap, formatPriceToFc, formatRoic } from "../utils/formatters";
import "./StockPage.css";

import logo from "../resources/Stock_Market_Logo.png";

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
  // user params hook extracts the symbol from the URL (e.g. /stock/AAPL)
  const { symbol } = useParams<{ symbol: string }>();
  const [stock, setStock] = useState<Stock | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [queryResult] = useState<string | null>(null);
  const [, setLoading] = useState(false);
  const [llmPrompt, setLlmPrompt] = useState("");

  // Fetch stock data from the API
  const fetchStock = async () => {
    if (!symbol) return;

    setLoading(true);
    try {
      console.log("Fetching stock data for:", symbol); // Debug log
      const stockData = await authPost<Stock>(DATA_ENDPOINTS.STOCK, { symbol });
      console.log("Received stock data:", stockData); // Debug log
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
      console.log("Response:", response); // Debug log
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
      console.log("Received in-depth data:", inDepthData); 
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
      <header className="main-header">
        <div className="stock-page-header-left">
          <h1 className="stock-page-header">
            {stock ? `${stock.symbol} - ${stock.name}` : symbol}
          </h1>
          <div className="stock-price-container">
            <div>${stock?.price.toFixed(2)}</div>
          </div>
        </div>
        <div className="stock-page-header-right">
          <div className="buy-hold-sell-container">
            <div className="stock-buy-rating-container">
              <span className="stock-buy-rating-label">Buy Rating</span>
              <div>{stock?.buy_rating}</div>
            </div>
            <div className="stock-hold-rating-container">
              <span className="stock-hold-rating-label">Hold Rating</span>
              <div>{stock?.hold_rating}</div>
            </div>
            <div className="stock-sell-rating-container">
              <span className="stock-sell-rating-label">Sell Rating</span>
              <div>{stock?.sell_rating}</div>
            </div>
          </div>
          <img
            src={logo}
            alt="Stock Market Logo"
            onClick={handleLogoClick}
            style={{ cursor: "pointer" }}
          />
        </div>
      </header>

      <div className="stock-data-container">
        <div className="stock-info-container-first">
          <span className="stock-info-label">EV/EBITDA</span>
          <div>{stock?.ev_to_ebita}</div>
        </div>
        <div className="stock-info-container">
          <span className="stock-info-label">PE Ratio</span>
          <div>{stock?.pe_ratio}</div>
        </div>
        <div className="stock-info-container">
          <span className="stock-info-label">Market Cap</span>
          <div>{formatMarketCap(stock?.market_cap || 0)}</div>
        </div>
        <div className="stock-info-container">
          <span className="stock-info-label">Dividend Yield</span>
          <div>{stock?.dividend_yield}</div>
        </div>
        <div className="stock-info-container">
          <span className="stock-info-label">Free Cash Flow</span>
          <div>{formatFreeCashFlow(stock?.free_cash_flow || 0)}</div>
        </div>
        <div className="stock-info-container">
          <span className="stock-info-label">Debt to Equity</span>
          <div>{formatDebtToEquity(stock?.debt_to_equity || 0)}</div>
        </div>
        <div className="stock-info-container">
          <span className="stock-info-label">ROIC</span>
          <div>{formatRoic(stock?.roic || 0)}</div>
        </div>
        <div className="stock-info-container">
          <span className="stock-info-label">Price to FC</span>
          <div>{formatPriceToFc(stock?.price_to_fc || 0)}</div>
        </div>

        <div className="stock-info-container-last">
          <span className="stock-info-label">Cash and Cash Equivalents</span>
          <div>
            {formatCashAndCashEquivalents(stock?.cashAndCashEquivalents || 0)}
          </div>
        </div>
      </div>
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
