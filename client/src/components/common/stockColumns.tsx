import { CellStyle, CellStyleFunc, ColDef, ValueFormatterParams } from 'ag-grid-community';
import { CustomCellRendererProps } from 'ag-grid-react';
import { COLUMN_REGISTRY, ColumnSpec } from '../../constants/tableColumns';
import removeIcon from '../../resources/x-close-delete-svgrepo-com.svg';
import { Stock } from '../../types';
import { formatMarketCap, formatVolume } from '../../utils/formatters';
import { healthColor } from '../../utils/healthColor';
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

/** The mini radar sparkline, coloured by average active-axis score (P3). */
export const radarColumn = (radarScores: RadarScores, activeAxes: string[] = []): ColDef<Stock> => ({
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

        const labels = (activeAxes.length ? activeAxes : Object.keys(scores)).filter((k) => k in scores);
        const dataPts = labels.map(l => scores[l]);
        const { borderColor, bgColor } = healthColor(scores, labels);

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

const formatBySpec = (spec: ColumnSpec, value: number | string | undefined | null): string => {
    if (value == null || value === "") return "N/A";
    if (spec.format === "text") return String(value);
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(num)) return "N/A";
    switch (spec.format) {
        case "currency":
            return `$${num.toFixed(2)}`;
        case "bigNumber":
            return formatMarketCap(num);
        case "percent":
            return `${(num * 100).toFixed(1)}%`;
        case "signedPercent": {
            const digits = spec.digits ?? 2;
            return `${num >= 0 ? "+" : ""}${num.toFixed(digits)}%`;
        }
        case "ratio":
            return num.toFixed(spec.digits ?? 2);
        case "integer":
            return num > 0 ? num.toFixed(0) : "N/A";
        case "volume":
            return formatVolume(num);
        default:
            return String(num);
    }
};

const metricFromSpec = (spec: ColumnSpec): ColDef<Stock> => ({
    colId: spec.id,
    headerName: spec.header,
    field: spec.field,
    width: spec.width,
    headerClass: spec.headerClass,
    cellStyle: spec.tone === "pnl" ? pnlCellStyle : undefined,
    valueGetter: (params) => params.data?.[spec.field],
    valueFormatter: (params: ValueFormatterParams<Stock>) => formatBySpec(spec, params.value as number | string | undefined),
    tooltipValueGetter: spec.tooltipField
        ? (params) => String(params.data?.[spec.tooltipField!] || "")
        : undefined,
});

/** Metric columns from the registry, filtered/ordered by the user's visible prefs. */
export const buildMetricColumns = (visibleIds: string[]): ColDef<Stock>[] => {
    const byId = new Map(COLUMN_REGISTRY.map((spec) => [spec.id, spec]));
    return visibleIds
        .map((id) => byId.get(id))
        .filter((spec): spec is ColumnSpec => Boolean(spec))
        .map(metricFromSpec);
};

/** Full metric set — used when no prefs are supplied. */
export const metricColumns = (): ColDef<Stock>[] => buildMetricColumns(COLUMN_REGISTRY.map((c) => c.id));

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
