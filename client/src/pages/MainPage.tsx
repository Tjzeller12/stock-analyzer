import "./MainPage.css";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import NewsFilterDropdown from "../NewsFilterDrop";
import logo from "../resources/Stock_Market_Logo.png";

// Stock interface contains data about a stock
interface Stock {
  symbol: string;
  name: string;
  rating: number;
  safety: number;
  price: number;
  pe_ratio: number;
  dividend: number;
}

interface Article {
  image_link: string;
  link: string;
  title: string;
  news_company: string;
  time_published: string;
  summary: string;
}

// MainPage component: Serves as the dashboard for the stock analyzer application
const MainPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchSymbol, setSearchSymbol] = useState("");
  const [newsFilter, setNewsFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);

  // Unified navigation handler for all buttons
  const handleButtonClick = (path: string) => {
    navigate(path);
  };

  // Special handler for logo click to return to main page
  const handleLogoClick = () => {
    navigate("/main");
  };

  // Handler for stock symbol search (placeholder for future implementation)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Search for:", searchSymbol);
    // Retrieve the token (assuming it's stored in local storage)
    const token = localStorage.getItem("token");
    // TODO: Implement actual search functionality
    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/search",
        { symbol: searchSymbol },
        { headers: 
          { "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, },
        }
      );
      console.log(response.data);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await axios.post("http://127.0.0.1:5000/auth/logout");
      console.log(response.data);
      const token = localStorage.getItem("token");
      console.log("Token:", token);
      localStorage.removeItem("token");
      
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleFilterChange = async (filter: string) => {
    setNewsFilter(filter);
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/news",
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

  useEffect(() => {
    handleFilterChange("All");
  }, []);

  // Placeholder data for stocks
  const stocks: Stock[] = [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      rating: 84,
      safety: 98,
      price: 150.25,
      pe_ratio: 4,
      dividend: 0.7,
    },
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      rating: 84,
      safety: 98,
      price: 150.25,
      pe_ratio: 4,
      dividend: 0.7,
    },
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      rating: 84,
      safety: 98,
      price: 150.25,
      pe_ratio: 4,
      dividend: 0.7,
    },
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      rating: 84,
      safety: 98,
      price: 150.25,
      pe_ratio: 4,
      dividend: 0.7,
    },
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      rating: 84,
      safety: 98,
      price: 150.25,
      pe_ratio: 4,
      dividend: 0.7,
    },
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      rating: 84,
      safety: 98,
      price: 150.25,
      pe_ratio: 4,
      dividend: 0.7,
    },
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      rating: 84,
      safety: 98,
      price: 150.25,
      pe_ratio: 4,
      dividend: 0.7,
    },
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      rating: 84,
      safety: 98,
      price: 150.25,
      pe_ratio: 4,
      dividend: 0.7,
    },
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      rating: 84,
      safety: 98,
      price: 150.25,
      pe_ratio: 4,
      dividend: 0.7,
    },
    {
      symbol: "GOOGL",
      name: "Alphabet Inc.",
      rating: 83,
      safety: 99,
      price: 2750.8,
      pe_ratio: 20,
      dividend: 0.4,
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corporation",
      rating: 90,
      safety: 100,
      price: 305.15,
      pe_ratio: 10,
      dividend: 0.6,
    },
    {
      symbol: "AMZN",
      name: "Amazon.com, Inc.",
      rating: 78,
      safety: 95,
      price: 3300.5,
      pe_ratio: 35.5,
      dividend: 0.0,
    },
    {
      symbol: "TSLA",
      name: "Tesla, Inc.",
      rating: 73,
      safety: 67,
      price: 780.9,
      pe_ratio: 80.2,
      dividend: 0.7,
    },
  ];
  // Placeholder data for news articles
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
  return (
    <div className="main-container">
      {/* Header section with title and clickable logo */}
      <header className="main-page-header">
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
        {[
          { label: "Profile", path: "/profile" },
          { label: "Watchlist", path: "/watchlist" },
          { label: "AI Predictor *Coming Soon*", path: "/aipredictor" },
          { label: "Settings", path: "/settings" },
        ].map((button) => (
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
      </div>

      {/* Stock symbol search form */}
      <div className="search-container">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Symbol i.e. NVDA"
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      </div>

      {/* Main content area with My Stocks and News buttons */}
      <div className="my-stocks-news-container">
        {/* stock data for all the users stocks */}
        <div className="stock-container">
          <h2 className="my-stocks-title">My Stocks</h2>
          <div className="stock-header">
            <div className="stock-symbol-header">Symbol</div>
            <div className="stock-name-header">Name</div>
            <div className="stock-rating-header">Rating</div>
            <div className="stock-safety-header">Safety</div>
            <div className="stock-price-header">Price</div>
            <div className="stock-pe_ratio-header">P/E Ratio</div>
            <div className="stock-dividend-header">Dividend</div>
          </div>
          <div className="stocks-list">
            {stocks.map((stock, index) => (
              <div
                key={stock.symbol}
                className={`stock-row ${index % 2 === 0 ? "even" : "odd"}`}
              >
                <div className="stock-symbol">{stock.symbol}</div>
                <div className="stock-name">{stock.name}</div>
                <div className="stock-rating">{stock.rating.toFixed(2)}</div>
                <div className="stock-safety">{stock.safety.toFixed(2)}</div>
                <div className="stock-price">${stock.price.toFixed(2)}</div>
                <div className="stock-pe_ratio">
                  {stock.pe_ratio.toFixed(1)}
                </div>
                <div className="stock-dividend">
                  {stock.dividend.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* news links for news that relates to the users stocks */}
        <div className="news-container">
          <h2 className="news-title">News</h2>
          <NewsFilterDropdown
            filter={newsFilter}
            setFilter={handleFilterChange}
          />
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
    </div>
  );
};

export default MainPage;
