import React, { useMemo } from "react";
import { Stock } from "../../types";
import { formatCashAndCashEquivalents, formatFreeCashFlow, formatMarketCap, formatVolume } from "../../utils/formatters";

interface MetricItem {
    label: string;
    value: string;
}

interface CategorySection {
    category: string;
    metrics: MetricItem[];
}

interface StockMetricsTableProps {
    stock: Stock | null;
}

const fmtPct  = (v: number | undefined | null, d = 1) => v != null ? `${(v * 100).toFixed(d)}%` : "N/A";
const fmtNum  = (v: number | undefined | null, d = 2)  => v != null ? v.toFixed(d) : "N/A";
const fmtMoney = (v: number | undefined | null) => v != null ? formatMarketCap(v) : "N/A";
const fmtCash  = (v: number | undefined | null) => v != null ? formatCashAndCashEquivalents(v) : "N/A";
const fmtFcf   = (v: number | undefined | null) => v != null ? formatFreeCashFlow(v) : "N/A";
const fmtPrice = (v: number | undefined | null) => v != null ? `$${v.toFixed(2)}` : "N/A";
const fmtStr   = (v: number | undefined | null) => v != null ? String(v) : "N/A";

const MetricRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 px-3 border-b border-border-main/10 last:border-b-0 hover:bg-border-main/5 transition-colors rounded-sm">
        <span className="text-xs text-text-main/60 font-medium truncate pr-2">{label}</span>
        <span className="text-xs font-bold text-text-main tabular-nums whitespace-nowrap">{value}</span>
    </div>
);

const CategoryCard: React.FC<{ section: CategorySection }> = ({ section }) => (
    <div className="bg-list-bg rounded-xl border border-border-main/10 shadow-md overflow-hidden flex flex-col">
        {/* Card Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-primary/5 border-b border-border-main/10">
            <span className="text-xs font-extrabold uppercase tracking-widest text-primary/80">
                {section.category}
            </span>
        </div>
        {/* Metric Rows */}
        <div className="flex flex-col flex-1">
            {section.metrics.map((m) => (
                <MetricRow key={m.label} label={m.label} value={m.value} />
            ))}
        </div>
    </div>
);

const StockMetricsTable: React.FC<StockMetricsTableProps> = ({ stock }) => {

    const sections: CategorySection[] = useMemo(() => {
        if (!stock) return [];
        return [
            {
                category: "Valuation",
                metrics: [
                    { label: "Price",         value: fmtPrice(stock.price) },
                    { label: "Market Cap",     value: fmtMoney(stock.market_cap) },
                    { label: "P/E Ratio",      value: fmtNum(stock.pe_ratio) },
                    { label: "Forward P/E",    value: fmtNum(stock.forward_pe) },
                    { label: "PEG Ratio",      value: fmtNum(stock.peg_ratio, 3) },
                    { label: "EV/EBITDA",      value: fmtNum(stock.ev_to_ebitda) },
                    { label: "P/S Ratio",      value: fmtNum(stock.price_to_sales) },
                    { label: "P/B Ratio",      value: fmtNum(stock.price_to_book) },
                    { label: "Price to FCF",   value: fmtNum(stock.price_to_fc) },
                ],
            },
            {
                category: "Profitability",
                metrics: [
                    { label: "ROE",              value: fmtPct(stock.roe) },
                    { label: "ROA",              value: fmtPct(stock.roa) },
                    { label: "ROIC",             value: fmtPct(stock.roic) },
                    { label: "Operating Margin", value: fmtPct(stock.operating_margin) },
                    { label: "Profit Margin",    value: fmtPct(stock.profit_margin) },
                    { label: "Net Income",       value: fmtFcf(stock.net_income) },
                ],
            },
            {
                category: "Cash Flow",
                metrics: [
                    { label: "Free Cash Flow",      value: fmtFcf(stock.free_cash_flow) },
                    { label: "Operating Cash Flow", value: fmtFcf(stock.operating_cash_flow) },
                    { label: "Capital Expenditures",value: fmtFcf(stock.capital_expenditures) },
                    { label: "Cash & Equivalents",  value: fmtCash(stock.cashAndCashEquivalents) },
                ],
            },
            {
                category: "Balance Sheet",
                metrics: [
                    { label: "Total Assets",      value: fmtMoney(stock.total_assets) },
                    { label: "Total Liabilities", value: fmtMoney(stock.total_liabilities) },
                    { label: "Shareholder Equity",value: fmtMoney(stock.total_shareholder_equity) },
                    { label: "Debt / Equity",     value: fmtNum(stock.debt_to_equity) },
                ],
            },
            {
                category: "Growth",
                metrics: [
                    { label: "Revenue Growth (QoQ)", value: fmtPct(stock.rev_growth_qoq) },
                    { label: "EPS Growth (QoQ)",     value: fmtPct(stock.eps_growth_qoq) },
                ],
            },
            {
                category: "Market",
                metrics: [
                    { label: "Dividend Yield",  value: fmtPct(stock.dividend_yield, 2) },
                    { label: "Beta",            value: fmtNum(stock.beta, 3) },
                    { label: "Volume",          value: stock.volume != null ? formatVolume(stock.volume) : "N/A" },
                    { label: "Price Change %",  value: fmtPct(stock.price_change_percent != null ? stock.price_change_percent / 100 : null) },
                ],
            },
            {
                category: "Analyst Ratings",
                metrics: [
                    { label: "Buy Ratings",  value: fmtStr(stock.buy_ratings_count) },
                    { label: "Hold Ratings", value: fmtStr(stock.hold_ratings_count) },
                    { label: "Sell Ratings", value: fmtStr(stock.sell_ratings_count) },
                ],
            },
            {
                category: "AI Scores",
                metrics: [
                    { label: "AI Moat Score",  value: fmtStr(stock.ai_moat_score) },
                    { label: "AI News Score",  value: fmtStr(stock.ai_news_score) },
                    { label: "Insider Volume", value: stock.insider_volume != null ? formatVolume(stock.insider_volume) : "N/A" },
                ],
            },
        ];
    }, [stock]);


    if (!stock) {
        return (
            <div className="flex justify-center items-center w-full h-40 text-text-main/40 text-sm">
                Loading metrics...
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 w-[97.5%] mx-auto mt-4 mb-4">
            {/* ── Responsive category grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {sections.map((section) => (
                    <CategoryCard key={section.category} section={section} />
                ))}
            </div>
        </div>
    );
};

export default StockMetricsTable;