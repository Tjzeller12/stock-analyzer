import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './Stock_Market_Logo.png';

const MainPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchSymbol, setSearchSymbol] = useState('');

    const handleButtonClick = (path: string) => {
        navigate(path);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Search for:', searchSymbol);
    };

    return (
        <div className="main-page">
            <header className="main-page-header">
                <button
                    className="main-page-button"
                    onClick={() => handleButtonClick('/MainPage')}
                >
                    Home
                </button>
                <h1>Stock Analyzer Dashboard</h1>
                <img src={logo} alt="Stock Market Logo" />
            </header>
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
            <div className="button-container">
                <button
                    className="nav-button"
                    onClick={() => handleButtonClick('/portfolio')}
                >
                    Portfolio
                </button>
                <button
                    className="nav-button"
                    onClick={() => handleButtonClick('/watchlist')}
                >
                    Watchlist
                </button>
                <button
                    className="nav-button"
                    onClick={() => handleButtonClick('/news')}
                >
                    News
                </button>
                <button
                    className="nav-button"
                    onClick={() => handleButtonClick('/profile')}
                >
                    Profile
                </button>
            </div>
        </div>
    );
};

export default MainPage;