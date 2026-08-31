import { CellStyle, CellStyleFunc, ColDef, ValueFormatterParams } from 'ag-grid-community';
import { CustomCellRendererProps } from 'ag-grid-react';
import removeIcon from '../../resources/x-close-delete-svgrepo-com.svg';
import { Stock } from '../../types';
import { formatMarketCap, formatVolume } from '../../utils/formatters';
import RadarGraph from './RadarGraph';

/**
 * Column builders for the stock tables.
 *
 * The watchlist and the real-portfolio tables share the vast majority of their
 * columns. Rather than branching inside one component with a `variant` flag,
 * each table composes exactly the columns it needs from these small builders
 * (see WatchlistTable / PortfolioTable). This keeps the tables honest about
 * their differences and avoids scattered `if` checks.
 */

type RadarScores = Record<string, Record<string, number>>;
type StockField = keyof Stock;

const fmtFixed = (digits: number) => (value: number) => value.toFixed(digits);
const fmtPct = (value: number) => `${(value * 100).toFixed(1)}%`;
const fmtCap = (value: number) => formatMarketCap(value);
const fmtMoney = (value: number) => `$${value.toFixed(2)}`;

/** Shared metric column: header + field + formatter. Missing values render as "N/A". */
const metricCol = (
    headerName: string,
    field: StockField,
    format: (value: number) => string,
    width: number,
    extra: Partial<ColDef<Stock>> = {},
): ColDef<Stock> => ({
    headerName,
    colId: String(field),
    valueGetter: (params) => params.data?.[field] as number | undefined,
    valueFormatter: (params: ValueFormatterParams<Stock, number>) =>
        params.value == null ? "N/A" : format(params.value),
    width,
    ...extra,
});

// Green for gains, red for losses. AG Grid's CellStyle index signature rejects
// `undefined`, so only set `color` when there's a sign to show.
const pnlCellStyle: CellStyleFunc<Stock> = (params) => {
    const value = params.value as number | null | undefined;
    const style: CellStyle = { fontWeight: 600 };
    if (value != null && value > 0) style.color = "#069042";
    else if (value != null && value < 0) style.color = "#ef4444";
    return style;
};

/** The mini radar sparkline, coloured by total score (traffic-light). */
export const radarColumn = (radarScores: RadarScores): ColDef<Stock> => ({
    colId: "radar",
    headerName: "Radar",
    pinned: "left",
    width: 120,
    sortable: false,
    filter: false,
    tooltipValueGetter: (params) => {
        const stock = params.data;
        if (!stock) return "";
        const scores = radarScores[stock.symbol];
        if (!scores) return "Loading...";
        return Object.entries(scores)
            .map(([key, val]) => `${key}: ${Math.round(val)}`)
            .join(' | ');
    },
    cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cellRenderer: (params: CustomCellRendererProps<Stock>) => {
        const stock = params.data;
        if (!stock) return null;
        const scores = radarScores[stock.symbol];
        if (!scores) return <div className="text-xs text-gray-500 flex items-center justify-center h-full">Loading...</div>;

        const labels = Object.keys(scores);
        const dataPts = labels.map(l => scores[l]);

        // Traffic-light: sum the axes (max 600) → green / yellow / red.
        const totalScore = dataPts.reduce((acc, curr) => acc + curr, 0);
        let borderColor = '#069042';
        let bgColor = 'rgba(6, 144, 66, 0.3)';
        if (totalScore < 300) {
            borderColor = '#ef4444';
            bgColor = 'rgba(239, 68, 68, 0.3)';
        } else if (totalScore <= 400) {
            borderColor = '#eab308';
            bgColor = 'rgba(234, 179, 8, 0.3)';
        }

        const chartData = {
            labels,
            datasets: [{
                label: stock.symbol,
                data: dataPts,
                backgroundColor: bgColor,
                borderColor: borderColor,
                borderWidth: 2,
                fill: true
            }]
        };

        return (
            <div className="w-[100px] h-[40px] flex items-center justify-center min-w-1 min-h-[40px]">
                <RadarGraph data={chartData} hideLegend={true} hideAxes={true} hideToolTip={true} height={50} outerRadius="100%" cy={"50%"} />
            </div>
        );
    }
});

export const symbolColumn = (): ColDef<Stock> => ({
    field: "symbol",
    headerName: "Symbol",
    pinned: "left",
    width: 100,
    cellClass: "font-bold text-primary"
});

/** Broker position columns — only the real-portfolio table uses these. */
export const positionColumns = (): ColDef<Stock>[] => ([
    {
        field: "quantity",
        headerName: "Shares",
        pinned: "left",
        width: 90,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? params.value.toLocaleString() : "N/A",
    },
    {
        field: "avg_cost",
        headerName: "Avg Cost",
        width: 110,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? `$${params.value.toFixed(2)}` : "N/A",
    },
    {
        field: "market_value",
        headerName: "Market Value",
        width: 130,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? `$${params.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "N/A",
    },
    {
        field: "unrealized_pnl",
        headerName: "Return",
        width: 120,
        cellStyle: pnlCellStyle,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? `${params.value >= 0 ? "+" : "-"}$${Math.abs(params.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "N/A",
    },
    {
        field: "unrealized_pnl_pct",
        headerName: "Return %",
        width: 110,
        cellStyle: pnlCellStyle,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? `${params.value >= 0 ? "+" : ""}${params.value.toFixed(2)}%` : "N/A",
    },
]);

/** The shared fundamental/metric columns rendered by every stock table. */
export const metricColumns = (): ColDef<Stock>[] => ([
    {
        field: "name",
        headerName: "Name",
        valueGetter: (params) => params.data?.name || "N/A",
        width: 200
    },
    metricCol("Price", "price", fmtMoney, 100),
    metricCol("Market Cap", "market_cap", fmtCap, 150),
    metricCol("P/E", "pe_ratio", fmtFixed(2), 100),
    metricCol("Fwd P/E", "forward_pe", fmtFixed(2), 120),
    metricCol("EV/EBITDA", "ev_to_ebitda", fmtFixed(2), 120),
    metricCol("P/S", "price_to_sales", fmtFixed(2), 100),
    metricCol("PEG", "peg_ratio", fmtFixed(3), 100),
    metricCol("ROE", "roe", fmtPct, 100),
    metricCol("Op Margin", "operating_margin", fmtPct, 120),
    metricCol("Profit Margin", "profit_margin", fmtPct, 140),
    metricCol("ROA", "roa", fmtPct, 100),
    metricCol("Rev Growth (QoQ)", "rev_growth_qoq", fmtPct, 160),
    metricCol("EPS Growth (QoQ)", "eps_growth_qoq", fmtPct, 160),
    metricCol("Total Assets", "total_assets", fmtCap, 140),
    metricCol("Total Liab.", "total_liabilities", fmtCap, 140),
    metricCol("Op. Cash Flow", "operating_cash_flow", fmtCap, 140),
    metricCol("CapEx", "capital_expenditures", fmtCap, 120),
    metricCol("Free Cash Flow", "free_cash_flow", fmtCap, 150),
    metricCol("Debt/Equity", "debt_to_equity", fmtFixed(2), 130),
    metricCol("Beta", "beta", fmtFixed(3), 100),
    {
        headerName: "Buy Ratings",
        valueGetter: (params) => params.data?.buy_ratings_count || 0,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => (params.value && params.value > 0) ? params.value.toString() : "N/A",
        width: 130
    },
    {
        field: "insider_volume",
        headerName: "Insider Vol",
        valueFormatter: (params: ValueFormatterParams<Stock, number | undefined>) => params.value ? formatVolume(params.value) : "0",
        width: 130
    },
    {
        headerName: "AI Moat",
        field: "ai_moat_score",
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null && params.value > 0 ? params.value.toFixed(0) : "N/A",
        tooltipValueGetter: (params) => params.data?.ai_moat_summary || "No moat summary available.",
        width: 110,
        headerClass: "ai-header-glow"
    },
    {
        headerName: "AI News",
        field: "ai_news_score",
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null && params.value > 0 ? params.value.toFixed(0) : "N/A",
        tooltipValueGetter: (params) => params.data?.ai_news_summary || "No recent news summary.",
        width: 110,
        headerClass: "ai-header-glow"
    },
]);

/** Multi-select checkbox column (drives the cross-table compare selection). */
export const selectColumn = (
    selectedSymbols: Set<string>,
    toggleSelectSymbol: (symbol: string) => void,
): ColDef<Stock> => ({
    colId: "select",
    headerName: "Select",
    pinned: "right",
    lockPinned: true,
    lockPosition: "right",
    suppressMovable: true,
    width: 90,
    sortable: false,
    filter: false,
    cellClass: "ag-cell-action",
    headerClass: "ag-cell-action",
    cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cellRenderer: (params: CustomCellRendererProps<Stock>) => {
        const stock = params.data;
        if (!stock) return null;
        return (
            <div className="flex items-center justify-center h-full">
                <input
                    className="w-[20px] h-[20px] cursor-pointer accent-[#069042]"
                    type="checkbox"
                    checked={selectedSymbols.has(stock.symbol)}
                    onChange={() => toggleSelectSymbol(stock.symbol)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${stock.symbol}`}
                />
            </div>
        );
    }
});

/** Remove button — watchlist only; you can't delete a real holding. */
export const removeColumn = (
    onRemove: (symbol: string) => void | Promise<void>,
): ColDef<Stock> => ({
    colId: "remove",
    headerName: "Remove",
    pinned: "right",
    lockPinned: true,
    lockPosition: "right",
    suppressMovable: true,
    width: 90,
    sortable: false,
    filter: false,
    cellClass: "ag-cell-action",
    headerClass: "ag-cell-action",
    cellStyle: { padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    cellRenderer: (params: CustomCellRendererProps<Stock>) => {
        const stock = params.data;
        if (!stock) return null;
        return (
            <div className="flex items-center justify-center h-full">
                <button
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 hover:shadow-md hover:shadow-red-500/20 active:scale-95"
                    onClick={(e) => {
                        e.stopPropagation();
                        void onRemove(stock.symbol);
                    }}
                    aria-label={`Remove ${stock.symbol}`}
                >
                    <img src={removeIcon} alt="Remove" className="w-[16px] h-[16px]" />
                </button>
            </div>
        );
    }
});
