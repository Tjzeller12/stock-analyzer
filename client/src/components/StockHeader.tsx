import React from 'react';
import { Stock } from '../types';
import { toneFor } from '../utils/ledTone';
import LedText, { LedDisplay } from './common/LedText';

interface StockHeaderProps {
    stock: Stock | null;
}

const RATINGS = [
    { key: 'buy_ratings_count', label: 'Buy', tone: 'up' },
    { key: 'hold_ratings_count', label: 'Hold', tone: 'flat' },
    { key: 'sell_ratings_count', label: 'Sell', tone: 'down' },
] as const;

/**
 * Quote board for the stock page: identity + price on the left, analyst
 * ratings on the right, all as LED readouts on a glass pane.
 */
const StockHeader: React.FC<StockHeaderProps> = ({ stock }) => {
    const pct = stock?.price_change_percent;
    const tone = toneFor(pct);
    const arrow = tone === 'up' ? '▲' : tone === 'down' ? '▼' : '■';

    return (
        <section className="tg-pane flex flex-wrap items-center justify-between gap-5 p-4 w-full">
            <div className="flex flex-wrap items-center gap-4 text-left min-w-0">
                <LedDisplay pitch="md" layerClassName="flex items-baseline gap-5 px-5 py-3 text-[30px]">
                    <LedText>{stock?.symbol ?? '····'}</LedText>
                    <LedText>{stock ? `$${stock.price.toFixed(2)}` : '—'}</LedText>
                    {pct != null && (
                        <LedText tone={tone} className="text-[22px]">
                            {arrow} {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                        </LedText>
                    )}
                </LedDisplay>
                <div className="min-w-0">
                    <h1 className="m-0 text-xl font-bold tracking-tight truncate">
                        {stock ? stock.name || 'Unknown Company' : 'Loading…'}
                    </h1>
                    {stock?.sector && (
                        <p className="m-0 mt-0.5 text-[11px] font-mono uppercase tracking-[0.12em] text-text-main/50">
                            {stock.sector}{stock.industry ? ` · ${stock.industry}` : ''}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex items-end gap-2">
                {RATINGS.map(({ key, label, tone: ratingTone }) => (
                    <div key={key} className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-main/55">{label}</span>
                        <LedDisplay pitch="md" layerClassName="px-3.5 py-2 text-[24px] min-w-[64px] text-center">
                            <LedText tone={ratingTone}>{stock?.[key] ?? '—'}</LedText>
                        </LedDisplay>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default StockHeader;
