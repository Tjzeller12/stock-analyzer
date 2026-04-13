import React from 'react';
import { Stock } from '../types';

interface StockHeaderProps {
    stock: Stock | null;
    onLogoClick: () => void;
    logo: string;
}

const StockHeader: React.FC<StockHeaderProps> = ({ stock, onLogoClick, logo}) => {

    const holdRating = stock?.hold_ratings_count !== undefined && stock.hold_ratings_count !== null ? stock.hold_ratings_count : "N/A";
    const sellRating = stock?.sell_ratings_count !== undefined && stock.sell_ratings_count !== null ? stock.sell_ratings_count : "N/A";

    return (
        <header className="flex justify-between items-center w-full min-h-[60px] bg-primary text-white font-bold px-6 py-2 box-border shadow-md">
            <div className="flex items-center gap-4">
                <h1 className="text-3xl text-white m-0 whitespace-nowrap tracking-tight drop-shadow-sm font-extrabold">
                    {stock ? `${stock.symbol} - ${stock.name || 'Unknown Company'}` : "Loading..."}
                </h1>
                <div className="flex justify-center items-center flex-row text-white text-xl font-bold gap-2 ml-4">
                    <div>${stock?.price.toFixed(2)}</div>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex justify-between items-center gap-2 bg-list-bg p-2 rounded-lg text-center shadow-lg border border-border-main/20 backdrop-blur-md">
                    <div className="flex justify-center items-center flex-row gap-2 bg-primary text-white rounded-md px-2 py-1 shadow-inner">
                        <span className="flex justify-center items-center text-xs font-bold text-white mb-px">Buy Rating</span>
                        <div className="font-extrabold text-sm">{stock?.buy_ratings_count}</div>
                    </div>
                    <div className="flex justify-center items-center flex-row gap-2 bg-yellow-500 text-white rounded-md px-2 py-1 shadow-inner">
                        <span className="flex justify-center items-center text-xs font-bold text-white mb-px">Hold Rating</span>
                        <div className="font-extrabold text-sm">{holdRating}</div>
                    </div>
                    <div className="flex justify-center items-center flex-row gap-2 bg-red-500 text-white rounded-md px-2 py-1 shadow-inner">
                        <span className="flex justify-center items-center text-xs font-bold text-white mb-px">Sell Rating</span>
                        <div className="font-extrabold text-sm">{sellRating}</div>
                    </div>
                </div>
                <img
                    src={logo}
                    alt="Stock Market Logo"
                    onClick={onLogoClick}
                    className="cursor-pointer max-h-[40px] w-auto hover:scale-105 transition-transform duration-300 ease-in-out"
                />
            </div>
        </header>
    )
}

export default StockHeader;