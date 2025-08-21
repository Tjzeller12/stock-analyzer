import axios from "axios";
import { DATA_ENDPOINTS, ALPHA_BOT_ENDPOINTS } from '../constants/api';
import { authPost } from '../utils/api';
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../main.css";
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
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [graph_period, setGraphPeriod] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [llmSummarySentiment, setLlmSummarySentiment] = useState(false);
  const [useLlama, setUseLlama] = useState(false);
  const [llmPrompt, setLlmPrompt] = useState("");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

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

  const fetchAlphaBotSummary = async () => {
    if (!symbol) return;

    try {
      const response = await authPost<{ summary: string }>(ALPHA_BOT_ENDPOINTS.NEWS_SUMMARY, { stock_symbol: symbol });
      console.log("Response:", response); // Debug log
      if (response.summary) {
        setSummary(response.summary);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const fetchAlphaBotSummarySentiment = async () => {
    if (!summary) return;
    setLoading(true);
    try {
      const sentimentData = await authPost<Sentiment>(ALPHA_BOT_ENDPOINTS.SENTIMENT, { summary });
      console.log("Received alpha bot article sentiment:", sentimentData); // Debug log
      setSentiment(sentimentData);
    } catch (error) {
      console.error("Alpha bot article sentiment fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };
  const handleSendRefresh = () => {
    if (useLlama) {
      handleLlamaPrompt();
    } else {
      fetchAlphaBotSummary();
    }
  };

  const handleLlamaPrompt = () => {
    if (llmPrompt) {
      console.log("Sending prompt:", llmPrompt);
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

  const formatMarketCap = (value: number) => {
    if (value >= 1e12) {
      return (value / 1e12).toFixed(1) + "T";
    } else if (value >= 1e9) {
      return (value / 1e9).toFixed(1) + "B";
    } else if (value >= 1e6) {
      return (value / 1e6).toFixed(1) + "M";
    } else if (value >= 1e3) {
      return (value / 1e3).toFixed(1) + "K";
    } else {
      return value.toString();
    }
  };

  const formatFreeCashFlow = (value: number) => {
    if (value >= 1e12) {
      return (value / 1e12).toFixed(1) + "T";
    } else if (value >= 1e9) {
      return (value / 1e9).toFixed(1) + "B";
    }
  };

  const formatDebtToEquity = (value: number) => {
    return value.toFixed(2);
  };

  const formatRoic = (value: number) => {
    return value.toFixed(2);
  };

  const formatPriceToFc = (value: number) => {
    return value.toFixed(2);
  };

  const formatCashAndCashEquivalents = (value: number) => {
    if (value >= 1e12) {
      return (value / 1e12).toFixed(1) + "T";
    } else if (value >= 1e9) {
      return (value / 1e9).toFixed(1) + "B";
    } else if (value >= 1e6) {
      return (value / 1e6).toFixed(1) + "M";
    }
    return value.toFixed(2);
  };

  useEffect(() => {
    fetchStock();
    fetchInDepthData();
    fetchAlphaBotSummary();
    fetchAlphaBotSummarySentiment();
  }, [symbol]);

  const handleButtonClick = (path: string) => {
    navigate(path);
  };

  const handleLogoClick = () => {
    navigate("/main");
  };

  const handleToggle = () => {
    setLlmSummarySentiment((prev) => !prev);
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
        <div className="stock-graph-container">
          <div className="stock-graph-header">
            <span className="stock-graph-header-label">Stock Price</span>
          </div>
          <div className="stock-graph-chart"></div>
        </div>
        <div className="stock-llm-container">
          <div className="stock-llm-header">
            <span className="stock-llm-header-label">Alpha Bot Summary</span>
          </div>
          <div className="stock-llm-text">
            <div>{stock?.news_summary || "Loading summary..."}</div>
          </div>
          {useLlama && (
            <div className="prompt-container">
              <input
                type="text"
                placeholder="Ask about this stock..."
                className="prompt-input"
                value={llmPrompt}
                onChange={(e) => setLlmPrompt(e.target.value)}
              />
            </div>
          )}
          <div className="llm-buttons-container">
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="llm-toggle"
                checked={useLlama}
                onChange={handleToggle}
              />
              <label htmlFor="llm-toggle">
                <span className="slider"></span>
              </label>
              <span className="toggle-label">
                {useLlama ? "Llama 3" : "Grok News"}
              </span>
            </div>
            <button className="send-refresh-button" onClick={handleSendRefresh}>
              {useLlama ? "Send" : "Refresh"}
              <i
                className={`fas ${useLlama ? "fa-paper-plane" : "fa-sync-alt"}`}
              ></i>
            </button>
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
