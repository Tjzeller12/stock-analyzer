import React from 'react';

interface StockHeaderProps {
    stock: any;
    onLogoClick: () => void;
    logo: string;
}

const StockHeader: React.FC<StockHeaderProps> = ({ stock, onLogoClick, logo}) => {
    return (
        <header className="main-header">
            <div className="stock-page-header-left">
                <h1 className="stock-page-header">
                    {stock ? `${stock.symbol} - ${stock.name}` : "Loading..."}
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
                    onClick={onLogoClick}
                    style={{ cursor: "pointer" }}
                />
            </div>
        </header>
    )
}

export default StockHeader;