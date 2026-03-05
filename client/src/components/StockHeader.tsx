import React from 'react';
import { Stock } from '../types';

interface StockHeaderProps {
    stock: Stock | null;
    onLogoClick: () => void;
    logo: string;
}

const StockHeader: React.FC<StockHeaderProps> = ({ stock, onLogoClick, logo}) => {

    const overview = stock?.company_overview || {};
    const buyRating = overview.AnalystRatingBuy || "N/A";
    const holdRating = overview.AnalystRatingHold || "N/A";
    const sellRating = overview.AnalystRatingSell || "N/A";

    return (
        <header className="flex justify-between items-center w-full min-h-[90px] bg-primary text-white font-bold px-6 py-4 box-border shadow-md">
            <div className="flex items-center gap-4">
                <h1 className="text-4xl text-white m-0 whitespace-nowrap tracking-tight drop-shadow-sm font-extrabold">
                    {stock ? `${stock.symbol} - ${stock.name}` : "Loading..."}
                </h1>
                <div className="flex justify-center items-center flex-row text-white text-3xl font-bold gap-2 ml-4">
                    <div>${stock?.price.toFixed(2)}</div>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex justify-between items-center gap-3 bg-list-bg p-3 rounded-xl text-center shadow-lg border border-border-main/20 backdrop-blur-md">
                    <div className="flex justify-center items-center flex-row gap-2 bg-primary text-white rounded-lg px-3 py-1.5 shadow-inner">
                        <span className="flex justify-center items-center text-sm font-bold text-white mb-px">Buy Rating</span>
                        <div className="font-extrabold">{buyRating}</div>
                    </div>
                    <div className="flex justify-center items-center flex-row gap-2 bg-yellow-500 text-white rounded-lg px-3 py-1.5 shadow-inner">
                        <span className="flex justify-center items-center text-sm font-bold text-white mb-px">Hold Rating</span>
                        <div className="font-extrabold">{holdRating}</div>
                    </div>
                    <div className="flex justify-center items-center flex-row gap-2 bg-red-500 text-white rounded-lg px-3 py-1.5 shadow-inner">
                        <span className="flex justify-center items-center text-sm font-bold text-white mb-px">Sell Rating</span>
                        <div className="font-extrabold">{sellRating}</div>
                    </div>
                </div>
                <img
                    src={logo}
                    alt="Stock Market Logo"
                    onClick={onLogoClick}
                    className="cursor-pointer max-h-[70px] w-auto hover:scale-110 transition-transform duration-300 ease-in-out"
                />
            </div>
        </header>
    )
}

export default StockHeader;