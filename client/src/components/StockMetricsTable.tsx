import React from "react";
import { Stock } from '../types';
import {
    formatCashAndCashEquivalents,
    formatDebtToEquity,
    formatFreeCashFlow,
    formatMarketCap,
    formatPriceToFc,
    formatRoic
} from '../utils/formatters';

interface MetricRowProps {
    label: string;
    value: string | number | undefined;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value }) => (
    <tr className="border-b border-border-main/20 last:border-b-0 hover:bg-border-main/5 transition-colors">
        <td className="p-4 text-base font-bold text-primary text-left w-1/2">{label}</td>
        <td className="p-4 text-base text-text-main text-right w-1/2 font-medium">{value}</td>
    </tr>
);

const StockMetricsTable: React.FC<{ stock: Stock | null }> = ({ stock }) => {
    return (
        <div className="flex justify-center items-start w-full max-w-[800px] p-6 bg-form-bg rounded-2xl mb-8 shadow-lg border border-border-main/10 mt-6 mx-auto relative overflow-hidden">
            <div className="absolute top-[-50%] left-[-10%] w-[100%] h-[100%] bg-primary/5 rounded-full blur-3xl -z-10"></div>
            <table className="w-full border-collapse relative z-10">
                <tbody>
                    <MetricRow label="EV/EBITDA" value={stock?.ev_to_ebita} />
                    <MetricRow label="PE Ratio" value={stock?.pe_ratio} />
                    <MetricRow label="Market Cap" value={formatMarketCap(stock?.market_cap || 0)} />
                    <MetricRow label="Dividend Yield" value={stock?.dividend_yield} />
                    <MetricRow label="Free Cash Flow" value={formatFreeCashFlow(stock?.free_cash_flow || 0)} />
                    <MetricRow label="Debt to Equity" value={formatDebtToEquity(stock?.debt_to_equity || 0)} />
                    <MetricRow label="ROIC" value={formatRoic(stock?.roic || 0)} />
                    <MetricRow label="Price to FC" value={formatPriceToFc(stock?.price_to_fc || 0)} />
                    <MetricRow label="Cash and Cash Equivalents" value={formatCashAndCashEquivalents(stock?.cashAndCashEquivalents || 0)} />
                </tbody>
            </table>
        </div>
    );
};

export default StockMetricsTable;