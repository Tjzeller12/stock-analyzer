import "./MainPage.css";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
}

// MainPage component: Serves as the dashboard for the stock analyzer application
const MainPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchSymbol, setSearchSymbol] = useState("");

  // Unified navigation handler for all buttons
  const handleButtonClick = (path: string) => {
    navigate(path);
  };

  // Special handler for logo click to return to main page
  const handleLogoClick = () => {
    navigate("/main");
  };

  // Handler for stock symbol search (placeholder for future implementation)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Search for:", searchSymbol);
    // TODO: Implement actual search functionality
  };
  // Placeholder data for stocks
  const stocks: Stock[] = [
      { symbol: "AAPL", name: "Apple Inc.", rating: 84, safety: 98, price: 150.25, pe_ratio: 4, dividend: .7 },
      { symbol: "GOOGL", name: "Alphabet Inc.", rating: 83, safety: 99, price: 2750.80, pe_ratio: 20, dividend: .4 },
      { symbol: "MSFT", name: "Microsoft Corporation", rating: 90, safety: 100, price: 305.15, pe_ratio: 10, dividend: .6 },
      { symbol: "AMZN", name: "Amazon.com, Inc.", rating: 78, safety: 95, price: 3300.50, pe_ratio: 35.5, dividend: .0 },
      { symbol: "TSLA", name: "Tesla, Inc.", rating: 73, safety: 67, price: 780.90, pe_ratio: 80.2, dividend: .7 },
  ];
  // Placeholder data for news articles
  const articles: Article[] = [
    {image_link: "somelink", link:"somelink", title:"Elon Musk tanks META stock down 20%", news_company:'X'},
    {image_link: "somelink", link:"somelink", title:"Joe Rogan, is Joe Hogans little brother which has caused GameStop to crash?", news_company:'CNN'},
    {image_link: "somelink", link:"somelink", title:"Donald Trump and Khamala Harris are having a baby? NVDA to the moon", news_company:'Fox'}
  ]

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
          { label: "Logout", path: "/login" },
        ].map((button) => (
          <button
            key={button.path}
            className="nav-button"
            onClick={() => handleButtonClick(button.path)}
          >
            {button.label}
          </button>
        ))}
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
          <button type="submit">Search</button>
        </form>
      </div>

      {/* Main content area with My Stocks and News buttons */}
      <div className="my-stocks-news-container">
        {/* stock data for all the users stocks */}
        <div className="stock-container">
          <h2 className="my-stocks-title">My Stocks</h2>
          <div className="stocks-list">
                {stocks.map((stock, index) => (
                    <div key={stock.symbol} className={`stock-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
                        <div className="stock-symbol">{stock.symbol}</div>
                        <div className="stock-name">{stock.name}</div>
                        <div className="stock-rating">{stock.rating.toFixed(2)}</div>
                        <div className="stock-safety">{stock.safety.toFixed(2)}</div>
                        <div className="stock-price">${stock.price.toFixed(2)}</div>
                        <div className="stock-pe_ratio">{stock.pe_ratio.toFixed(1)}</div>
                        <div className="stock-dividend">{stock.dividend.toFixed(1)}%</div>
                    </div>
                ))}
            </div>
        </div>
        {/* news links for news that relates to the users stocks */}
          <div className="news-container">
            <h2 className="news-title">News</h2>
            <div className="news-list">
              {articles.map((article, index) => (
                <div key={article.link} className={`article-row ${index % 2 === 0 ? 'even' : 'odd'}`} onClick={() => window.open(article.link, '_blank')}>
                    <img src={article.image_link}></img>
                    <div className="article-title">{article.title} </div>
                    <div className="news-company">{article.news_company} </div>
                </div>
              ))}
            </div>
        
          </div>
      </div>

    </div>
  );
};

export default MainPage;
