import React from 'react';
import { Stock } from '../types';

interface StockHeaderProps {
    stock?: Stock;
}

const StockHeader = ({ stock }: StockHeaderProps) => {
    const buyRating = stock?.buy_ratings_count ?? "N/A";
    const holdRating = stock?.hold_ratings_count ?? "N/A";
    const sellRating = stock?.sell_ratings_count ?? "N/A";

    return (
        <div className="flex justify-between items-center w-full min-h-[50px] bg-glass-bg text-text-main font-bold px-6 py-2 box-border border-b border-border-main/20">
            <div className="text-xl font-extrabold">
                ${stock?.price.toFixed(2)}
            </div>
            <div className="flex items-center gap-2">
                <div className="flex gap-2 bg-background/50 p-1.5 rounded-lg border border-border-main/20">
                    <span className="flex items-center gap-1.5 bg-primary text-white rounded-md px-2.5 py-1 text-xs font-bold">
                        Buy <strong>{buyRating}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 bg-yellow-500 text-white rounded-md px-2.5 py-1 text-xs font-bold">
                        Hold <strong>{holdRating}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 bg-red-500 text-white rounded-md px-2.5 py-1 text-xs font-bold">
                        Sell <strong>{sellRating}</strong>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default StockHeader;
