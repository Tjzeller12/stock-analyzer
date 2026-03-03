import React from "react";
import { 
    formatMarketCap, 
    formatFreeCashFlow, 
    formatDebtToEquity, 
    formatRoic, 
    formatPriceToFc, 
    formatCashAndCashEquivalents 
} from '../utils/formatters';

interface MetricRowProps {
    label: string;
    value: string | number | undefined;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value }) => (
    <tr>
        <td className="stock-info-label">{label}</td>
        <td className="stock-info-value">{value}</td>
    </tr>
);

const StockMetricsTable: React.FC<{ stock: any }> = ({ stock }) => {
    return (
        <div className="stock-data-container">
            <table className="stock-data-table">
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