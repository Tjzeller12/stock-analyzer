import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DATA_ENDPOINTS } from '../constants/api';
import "../main.css";
import { authPost } from '../utils/api';
import "./StockPage.css";
import logo from "../resources/Stock_Market_Logo.png";
import StockMetricsTable from "../components/StockMetricsTable";
import StockHeader from "../components/StockHeader";

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
  const [loading, setLoading] = useState(false);

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
    fetchStock();
    fetchInDepthData();
  }, [symbol]);

  const handleButtonClick = (path: string) => {
    navigate(path);
  };

  const handleLogoClick = () => {
    navigate("/main");
  };

  return (
    <div className="stock-container">
<StockHeader stock={stock} onLogoClick={handleLogoClick} logo={logo} />

      <StockMetricsTable stock={stock} />
      
    </div>
  );
};

export default StockPage;
