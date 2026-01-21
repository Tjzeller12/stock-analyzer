import axios from "axios";
import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import React, { useContext, useEffect, useState } from "react";
import { Radar } from 'react-chartjs-2';
import Markdown from 'react-markdown';
import { useNavigate } from "react-router-dom";
import remarkGfm from 'remark-gfm';
import NewsFilterDropdown from "../NewsFilterDrop";
import { ThemeContext } from "../ThemeContext";
import { ALPHA_BOT_ENDPOINTS, AUTH_ENDPOINTS, DATA_ENDPOINTS, PORTFOLIO_ENDPOINTS } from '../constants/api';
import "../main.css";
import logo from "../resources/Stock_Market_Logo.png";
import refresh_icon from "../resources/refresh_icon.png";
import { authPost } from '../utils/api';
import "./MainPage.css";

// Stock interface contains data about a stock
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
}

// Article interface contains data about a news article
interface Article {
  image_link: string;
  link: string;
  title: string;
  news_company: string;
  time_published: string;
  summary: string;
}

interface CompareResponse {
  analysis: string;
  radarChartData: RadarChartData;
}

interface AlphaBotResponse {
  response: string;
}

interface RadarChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    fill?: boolean;
  }[];
}

// Chart colors expanded palette
const CHART_COLORS = [
  { bg: 'rgba(252, 26, 26, 0.1)', border: 'rgba(252, 26, 26, 1)' },
  { bg: 'rgba(8, 137, 16, 0.1)', border: 'rgba(8, 137, 16, 1)' }, 
  { bg: 'rgba(255, 206, 86, 0.1)', border: 'rgba(255, 206, 86, 1)' }, 
  { bg: 'rgba(63, 207, 255, 0.1)', border: 'rgba(63, 207, 255, 1)' }, 
  { bg: 'rgba(153, 102, 255, 0.1)', border: 'rgba(153, 102, 255, 1)' }, 
  { bg: 'rgba(255, 159, 64, 0.1)', border: 'rgba(255, 159, 64, 1)' }, 
  { bg: 'rgba(43, 0, 255, 0.1)', border: 'rgba(43, 0, 255, 1)' }, 
  { bg: 'rgba(255, 99, 255, 0.1)', border: 'rgba(255, 99, 255, 1)' }, 
  { bg: 'rgba(0, 255, 255, 0.1)', border: 'rgba(0, 255, 255, 1)' }, 
  { bg: 'rgba(50, 205, 50, 0.1)', border: 'rgba(50, 205, 50, 1)' }, 
];

const parseCompareResponse = (response: string | undefined): CompareResponse | null => {
  if (!response) return null;
  try {
    // Extract JSON substring if there's extra text
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    let jsonString = jsonMatch ? jsonMatch[0] : response;
    
    // REMOVED SANITIZER: It was breaking valid structural newlines.
    // We trust that the Regex above extracted just the JSON, and standard JSON.parse will work.

    const parsedResponse = JSON.parse(jsonString);
    
    // Inject styling into Radar Chart datasets
    if (parsedResponse.radarChartData && parsedResponse.radarChartData.datasets) {
       parsedResponse.radarChartData.datasets.forEach((dataset: any, index: number) => {
          const color = CHART_COLORS[index % CHART_COLORS.length];
          dataset.backgroundColor = color.bg;
          dataset.borderColor = color.border;
          dataset.borderWidth = 2;
          dataset.fill = true;
       });
    }

    return parsedResponse;
  } catch (error) {
    console.error("Failed to parse compare response.", error);
    return null;
  }
}

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

// MainPage component: Serves as the dashboard for the stock analyzer application
const MainPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchSymbol, setSearchSymbol] = useState("");
  const [newsFilter, setNewsFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [sortBy, setSortBy] = useState("ev_to_ebita");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);
  const { theme, toggleTheme } = useContext(ThemeContext);

  // Unified navigation handler for all buttons
  const handleButtonClick = (path: string) => {
    navigate(path);
  };

  // Determine Chart Colors based on Theme
  const textColor = theme === 'light' ? '#666' : '#e0e0e0';
  const gridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.2)';

  const radarOptions = {
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          backdropColor: 'transparent',
          color: textColor,
        },
        pointLabels: {
          color: textColor,
          font: {
            size: 12
          }
        },
        grid: {
          color: gridColor,
        },
        angleLines: {
            color: gridColor
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
            color: textColor
        }
      }
    }
  };


  const toggleSelectSymbol = (symbol: string) => {
    setSelectedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const handleCompare = async () => {
    setCompareError(null);
    setCompareResult(null);
    const symbols = Array.from(selectedSymbols);
    if (symbols.length < 2) {
      setCompareError("Select at least 2 stocks to compare.");
      return;
    }
    if (symbols.length > 10) {
      setCompareError("You can compare at most 10 stocks at once.");
      return;
    }
    try {
      setCompareLoading(true);
      const alphaBotResponse: AlphaBotResponse | null = await authPost<AlphaBotResponse>(ALPHA_BOT_ENDPOINTS.COMPARE, { stock_symbols: symbols });
      const result = parseCompareResponse(alphaBotResponse?.response);
      setCompareResult(result);
    } catch (err) {
      setCompareError("Comparison failed. Please try again.");
    } finally {
      setCompareLoading(false);
    }
  };

  // Special handler for logo click to return to main page
  const handleLogoClick = () => {
    navigate("/main");
  };
  //Get the token and return it to send to the backend
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };
  // Handler for refresh (placeholder for future implementation)
  const handleRefresh = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Refresh Stocks");
    // TODO: Implement actual search functionality
    try {
      await authPost(PORTFOLIO_ENDPOINTS.REFRESH, {});
      fetchStocks();
    } catch (error) {
      console.error("Refresh failed:", error);
    }
  };

  // Handler for stock symbol search (placeholder for future implementation)
  const handleRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Search for:", searchSymbol);
    // TODO: Implement actual search functionality
    try {
      await authPost(PORTFOLIO_ENDPOINTS.REMOVE, { symbol: searchSymbol });
      fetchStocks();
    } catch (error) {
      console.error("Remove failed:", error);
    }
  };
  // Handler for stock symbol search (placeholder for future implementation)
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Search for:", searchSymbol);

    // TODO: Implement actual search functionality
    try {
      await authPost(PORTFOLIO_ENDPOINTS.ADD, { symbol: searchSymbol });
      fetchStocks();
    } catch (error) {
      console.error("Add failed:", error);
    }
  };

  // Logout function
  const handleLogout = async () => {
    try {
      const response = await axios.post(AUTH_ENDPOINTS.LOGOUT);
      console.log(response.data);
      const token = localStorage.getItem("token");
      console.log("Token:", token);
      localStorage.removeItem("token");

      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Fetch stocks from the server
  const fetchStocks = async () => {
    const token = localStorage.getItem("token");
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        PORTFOLIO_ENDPOINTS.STOCKS,
        { sortBy: sortBy },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (Array.isArray(response.data)) {
        setStocks(response.data);
      } else {
        setError("No stocks found.");
      }
    } catch (error) {
      console.error("Sorting failed:", error);
      setError("Failed to fetch stocks.");
    } finally {
      setLoading(false);
    }
  };

  const handleStockClick = (symbol: string) => {
    navigate(`/stock/${symbol}`);
  };

  const handleFilterChange = async (filter: string) => {
    setNewsFilter(filter);
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        DATA_ENDPOINTS.NEWS,
        { filter: filter },
        { headers: { "Content-Type": "application/json" } }
      );
      let extractedArticles: Article[] = [];

      if (Array.isArray(response.data)) {
        extractedArticles = response.data;
      } else if (typeof response.data === "object" && response.data !== null) {
        // Check for common properties that might contain the articles array
        if (Array.isArray(response.data.articles)) {
          extractedArticles = response.data.articles;
        } else if (Array.isArray(response.data.feed)) {
          extractedArticles = response.data.feed;
        } else {
          // If we can't find an array, try to create an array from the object
          extractedArticles = [response.data];
        }
      }
      if (extractedArticles.length > 0) {
        setArticles(extractedArticles);
      } else {
        setError("No articles found");
      }
    } catch (error) {
      console.error("Filter failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    // Alpha Vantage format: YYYYMMDDTHHMM
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    const hour = dateString.substring(9, 11);
    const minute = dateString.substring(11, 13);
    const formattedDate = `${year}-${month}-${day}T${hour}:${minute}:00Z`;
    return new Date(formattedDate).toLocaleString();
  };

  // Format market cap
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
  useEffect(() => {
    fetchStocks();
    handleFilterChange("All");
  }, []);
  useEffect(() => {
    // Called whenever sortBy changes
    fetchStocks();
  }, [sortBy]);

  // Main page
  return (
    <div className="main-container">
      {/* Header section with title and clickable logo */}
      <header className="main-header">
        <h1>Stock Analyzer Dashboard</h1>
        <img
          src={logo}
          alt="Stock Market Logo"
          onClick={handleLogoClick}
          style={{ cursor: "pointer" }}
        />
      </header>

      {/* Navigation buttons for additional features */}
      <div className="button-container">
        {[{ label: "Profile", path: "/profile" }].map((button) => (
          <button
            key={button.path}
            className="nav-button"
            onClick={() => handleButtonClick(button.path)}
          >
            {button.label}
          </button>
        ))}
        <button className="nav-button" onClick={() => handleLogout()}>
          Logout
        </button>
        <div className="toggle-switch">
          <input
            type="checkbox"
            id="theme"
            checked={theme === "dark"}
            onChange={toggleTheme}
          />
          <label htmlFor="theme">
            <span className="slider"></span>
          </label>
          <span className="toggle-label">Dark Theme</span>
        </div>
      </div>

      {/* Stock symbol search form */}
      <div className="search-container">
        <form>
          <input
            type="text"
            placeholder="Symbol i.e. NVDA"
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            className="input-field"
          />
          <button
            type="button"
            onClick={handleAdd}
            title="Add Stock"
            className="add-button"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleRemove}
            title="Remove Stock"
            className="remove-button"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh Portfolio"
            className="refresh-button"
          >
            <img src={refresh_icon} alt="Stock Market Logo" />
          </button>
        </form>
      </div>
      <div className="sort-by-dropdown"></div>

      {/* Main content area with My Stocks and News buttons */}
      <div className="my-stocks-news-container">
        {/* stock data for all the users stocks */}
        <div className="stock-container">
          <h2 className="my-stocks-title">My Stocks</h2>
          <div className="list-header">
            {/* Negative symbols in front of sort by value indicate that it should be sorted in decending order. */}
            <div
              className="stock-list-name"
              onClick={() => setSortBy("symbol")}
            >
              Symbol
            </div>
            <div className="stock-list-name" onClick={() => setSortBy("name")}>
              Name
            </div>
            <div className="stock-list-name" onClick={() => setSortBy("price")}>
              Price
            </div>
            <div
              className="stock-list-name"
              onClick={() => setSortBy("-ev_to_ebita")}
            >
              EV/EBITA
            </div>
            <div
              className="stock-list-name"
              onClick={() => setSortBy("pe_ratio")}
            >
              P/E Ratio
            </div>
            <div
              className="stock-list-name"
              onClick={() => setSortBy("-market_cap")}
            >
              Market Cap
            </div>
            <div
              className="stock-list-name"
              onClick={() => setSortBy("-dividend_yield")}
            >
              Dividend
            </div>
          </div>
          <div className="stocks-list">
            {stocks.map((stock, index) => (
              <div
                key={stock.symbol}
                className={`stock-row ${index % 2 === 0 ? "even" : "odd"}`}
                style={{ cursor: "pointer" }}
                onClick={() => handleStockClick(stock.symbol)}
              >
                <div className="stock-symbol">{stock.symbol}</div>
                <div className="stock-name">{stock.name}</div>
                <div className="stock-data">${stock.price.toFixed(2)}</div>
                <div className="stock-data">{stock.ev_to_ebita.toFixed(2)}</div>
                <div className="stock-data">{stock.pe_ratio.toFixed(2)}</div>
                <div className="stock-data">{formatMarketCap(stock.market_cap)}</div>
                <div className="stock-data">{stock.dividend_yield.toFixed(2)}%</div>
                <div className="stock-action-cell">
                  <input
                    className="action-checkbox"
                    type="checkbox"
                    checked={selectedSymbols.has(stock.symbol)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelectSymbol(stock.symbol);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${stock.symbol}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="compare-bar">
            <button
              type="button"
              onClick={handleCompare}
              disabled={selectedSymbols.size < 2 || selectedSymbols.size > 10 || compareLoading}
              className="nav-button"
              title="Compare selected stocks"
            >
              {compareLoading ? "Comparing..." : "Compare Selected"}
            </button>
            <span style={{ fontSize: 12 }}>
              Selected: {selectedSymbols.size} (min 2, max 10)
            </span>
            {compareError && (
              <span style={{ color: "red", fontSize: 12 }}>{compareError}</span>
            )}
          </div>
        </div>

        {/* news links for news that relates to the users stocks */}
        <div className="news-container">
          <h2 className="news-title">News</h2>
          <div className="list-header news-list-header">
            <NewsFilterDropdown
              filter={newsFilter}
              setFilter={handleFilterChange}
            />
          </div>
          <div className="news-list">
            {articles.map((article, index) => (
              <div
                key={article.link}
                className={`article-row ${index % 2 === 0 ? "even" : "odd"}`}
                onClick={() => window.open(article.link, "_blank")}
              >
                <img className="news-header-img" src={article.image_link}></img>
                <p className="article-summary"></p>
                <div className="article-meta">
                  <div className="article-title">{article.title} </div>
                  <span className="news-company">{article.news_company}</span>
                  <span className="time-published">
                    {formatDate(article.time_published)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Comparison result */}
      <div className="compare-result-container">
        {compareResult && (
          <div>
            <div className="compare-radar-chart-container">
              <h1>Stock Ranking Chart</h1>
              <Radar data={compareResult.radarChartData} options={radarOptions} />
            </div>
            <div className="analysis-body">
              <Markdown remarkPlugins={[remarkGfm]}>{compareResult.analysis}</Markdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainPage;
