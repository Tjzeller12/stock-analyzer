import "./MainPage.css";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../resources/Stock_Market_Logo.png";
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

      {/* Navigation buttons */}
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

      {/* Main content area with Portfolio and News buttons */}
      <div className="portfolio-news-container">
        <button
          className="portfolio-button"
          onClick={() => handleButtonClick("/portfolio")}
        >
          Portfolio
          <div className="graph-placeholder"></div>
        </button>
        <button
          className="news-button"
          onClick={() => handleButtonClick("/news")}
        >
          News
          <div className="news-placeholder"></div>
        </button>
      </div>
    </div>
  );
};

export default MainPage;
