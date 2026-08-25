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
    {
        field: "price",
        headerName: "Price",
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? `$${params.value.toFixed(2)}` : "N/A",
        width: 100
    },
    {
        headerName: "Market Cap",
        valueGetter: (params) => params.data?.market_cap,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value ? formatMarketCap(params.value) : "N/A",
        width: 150
    },
    {
        headerName: "P/E",
        valueGetter: (params) => params.data?.pe_ratio,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? params.value.toFixed(2) : "N/A",
        width: 100
    },
    {
        headerName: "Fwd P/E",
        valueGetter: (params) => params.data?.forward_pe,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? params.value.toFixed(2) : "N/A",
        width: 120
    },
    {
        headerName: "EV/EBITDA",
        valueGetter: (params) => params.data?.ev_to_ebitda,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? params.value.toFixed(2) : "N/A",
        width: 120
    },
    {
        headerName: "P/S",
        valueGetter: (params) => params.data?.price_to_sales,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? params.value.toFixed(2) : "N/A",
        width: 100
    },
    {
        headerName: "PEG",
        valueGetter: (params) => params.data?.peg_ratio,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? params.value.toFixed(3) : "N/A",
        width: 100
    },
    {
        headerName: "ROE",
        valueGetter: (params) => params.data?.roe,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => {
            if (params.value === undefined || params.value === null) return "N/A";
            return `${(params.value * 100).toFixed(1)}%`;
        },
        width: 100
    },
    {
        headerName: "Op Margin",
        valueGetter: (params) => params.data?.operating_margin,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => {
            if (params.value === undefined || params.value === null) return "N/A";
            return `${(params.value * 100).toFixed(1)}%`;
        },
        width: 120
    },
    {
        headerName: "Profit Margin",
        valueGetter: (params) => params.data?.profit_margin,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => {
            if (params.value === undefined || params.value === null) return "N/A";
            return `${(params.value * 100).toFixed(1)}%`;
        },
        width: 140
    },
    {
        headerName: "ROA",
        valueGetter: (params) => params.data?.roa,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => {
            if (params.value === undefined || params.value === null) return "N/A";
            return `${(params.value * 100).toFixed(1)}%`;
        },
        width: 100
    },
    {
        headerName: "Rev Growth (QoQ)",
        valueGetter: (params) => params.data?.rev_growth_qoq,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => {
            if (params.value === undefined || params.value === null) return "N/A";
            return `${(params.value * 100).toFixed(1)}%`;
        },
        width: 160
    },
    {
        headerName: "EPS Growth (QoQ)",
        valueGetter: (params) => params.data?.eps_growth_qoq,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => {
            if (params.value === undefined || params.value === null) return "N/A";
            return `${(params.value * 100).toFixed(1)}%`;
        },
        width: 160
    },
    {
        headerName: "Total Assets",
        valueGetter: (params) => params.data?.total_assets,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? formatMarketCap(params.value) : "N/A",
        width: 140
    },
    {
        headerName: "Total Liab.",
        valueGetter: (params) => params.data?.total_liabilities,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? formatMarketCap(params.value) : "N/A",
        width: 140
    },
    {
        headerName: "Op. Cash Flow",
        valueGetter: (params) => params.data?.operating_cash_flow,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? formatMarketCap(params.value) : "N/A",
        width: 140
    },
    {
        headerName: "CapEx",
        valueGetter: (params) => params.data?.capital_expenditures,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? formatMarketCap(params.value) : "N/A",
        width: 120
    },
    {
        headerName: "Free Cash Flow",
        valueGetter: (params) => params.data?.free_cash_flow,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? formatMarketCap(params.value) : "N/A",
        width: 150
    },
    {
        headerName: "Debt/Equity",
        valueGetter: (params) => params.data?.debt_to_equity,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? params.value.toFixed(2) : "N/A",
        width: 130
    },
    {
        headerName: "Beta",
        valueGetter: (params) => params.data?.beta,
        valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value != null ? params.value.toFixed(3) : "N/A",
        width: 100
    },
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
