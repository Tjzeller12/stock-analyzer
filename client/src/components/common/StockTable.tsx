import { ClientSideRowModelModule, ColDef, ValidationModule, ValueFormatterParams, themeQuartz } from 'ag-grid-community';
import { AgGridReact, CustomCellRendererProps } from 'ag-grid-react';
import React, { useContext, useMemo } from 'react';
import { ThemeContext } from '../../ThemeContext';
import removeIcon from '../../resources/x-close-delete-svgrepo-com.svg';
import { Stock } from '../../types';
import { formatMarketCap, formatVolume } from '../../utils/formatters';
import ControlPanel from './ControlPanel';

// AG Grid styles moved to index.css for correct ordering

export interface StockTableProps {
    stocks: Stock[];
    selectedSymbols: Set<string>;
    toggleSelectSymbol: (symbol: string) => void;
    onRowClick: (symbol: string) => void;
    onCompare: () => void;
    onRemove: (symbol: string) => Promise<void>;
    onAdd: (symbol: string) => Promise<void>;
    onRefresh: () => Promise<void>;
    compareLoading: boolean;
    compareError: string | null;
    error: string | null;
    onSort: (field: string) => void;
}

/**
 * StockTable Component
 * 
 * A complex composite component specifically designed to display a portfolio of stocks.
 * It combines the `AgGridReact` component with the `ControlPanel` UI to provide an 
 * integrated interface for searching/adding stocks, selecting multiple stocks via checkboxes
 * for LLM comparison, deleting stocks, and sorting columns by financial metrics.
 */
const StockTable: React.FC<StockTableProps> = ({
    stocks,
    selectedSymbols,
    toggleSelectSymbol,
    onRowClick,
    onCompare,
    onRemove,
    onAdd,
    onRefresh,
    compareLoading,
    compareError,
    error,
}) => {
    const { theme } = useContext(ThemeContext);

    // Modern V35 programmatic theme hooking native dark mode text/scrollbars without breaking SASS variables
    const myTheme = useMemo(() => {
        return themeQuartz.withParams({
            backgroundColor: "transparent",
            foregroundColor: theme === 'dark' ? "#ffffff" : "#0f0f0f",
            browserColorScheme: theme === 'dark' ? "dark" : "light",
            headerBackgroundColor: "transparent",
            rowHoverColor: "rgba(157, 157, 157, 0.1)",
            wrapperBorder: false,
            rowBorder: false,
            columnBorder: false,
        });
    }, [theme]);

    // AG Grid columns definition
    const columnDefs: ColDef<Stock>[] = useMemo(() => [
        { 
            field: "symbol", 
            headerName: "Symbol", 
            pinned: "left", 
            width: 100,
            cellClass: "font-bold text-primary"
        },
        { 
            field: "name", 
            headerName: "Name", 
            valueGetter: (params) => params.data?.company_overview?.Name || "N/A",
            width: 200 
        },
        { 
            field: "price", 
            headerName: "Price", 
            valueFormatter: (params: ValueFormatterParams<Stock, number>) => params.value ? `$${params.value.toFixed(2)}` : "N/A",
            width: 100 
        },
        { 
            headerName: "Market Cap", 
            valueGetter: (params) => params.data?.company_overview?.MarketCapitalization,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => params.value ? formatMarketCap(parseFloat(params.value)) : "N/A",
            width: 150 
        },
        { 
            headerName: "P/E", 
            valueGetter: (params) => params.data?.company_overview?.PERatio,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => params.value ? parseFloat(params.value).toFixed(2) : "N/A",
            width: 100 
        },
        { 
            headerName: "Fwd P/E", 
            valueGetter: (params) => params.data?.company_overview?.ForwardPE,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => params.value ? parseFloat(params.value).toFixed(2) : "N/A",
            width: 120 
        },
        { 
            headerName: "EV/EBITDA", 
            valueGetter: (params) => params.data?.company_overview?.EVToEBITDA,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => params.value ? parseFloat(params.value).toFixed(2) : "N/A",
            width: 120 
        },
        { 
            headerName: "P/S", 
            valueGetter: (params) => params.data?.company_overview?.PriceToSalesRatioTTM,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => params.value ? parseFloat(params.value).toFixed(2) : "N/A",
            width: 100 
        },
        { 
            headerName: "PEG", 
            valueGetter: (params) => params.data?.company_overview?.PEGRatio,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => params.value ? parseFloat(params.value).toFixed(3) : "N/A",
            width: 100 
        },
        { 
            headerName: "ROE", 
            valueGetter: (params) => params.data?.company_overview?.ReturnOnEquityTTM,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => {
                if (!params.value || params.value === "None") return "N/A";
                return `${(parseFloat(params.value) * 100).toFixed(1)}%`;
            },
            width: 100 
        },
        { 
            headerName: "Op Margin", 
            valueGetter: (params) => params.data?.company_overview?.OperatingMarginTTM,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => {
                if (!params.value || params.value === "None") return "N/A";
                return `${(parseFloat(params.value) * 100).toFixed(1)}%`;
            },
            width: 120 
        },
        { 
            headerName: "Profit Margin", 
            valueGetter: (params) => params.data?.company_overview?.ProfitMargin,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => {
                if (!params.value || params.value === "None") return "N/A";
                return `${(parseFloat(params.value) * 100).toFixed(1)}%`;
            },
            width: 140 
        },
        { 
            headerName: "Rev Growth (QoQ)", 
            valueGetter: (params) => params.data?.company_overview?.QuarterlyRevenueGrowthYOY,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => {
                if (!params.value || params.value === "None") return "N/A";
                return `${(parseFloat(params.value) * 100).toFixed(1)}%`;
            },
            width: 160 
        },
        { 
            headerName: "EPS Growth (QoQ)", 
            valueGetter: (params) => params.data?.company_overview?.QuarterlyEarningsGrowthYOY,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => {
                if (!params.value || params.value === "None") return "N/A";
                return `${(parseFloat(params.value) * 100).toFixed(1)}%`;
            },
            width: 160 
        },
        { 
            headerName: "Beta", 
            valueGetter: (params) => params.data?.company_overview?.Beta,
            valueFormatter: (params: ValueFormatterParams<Stock, string>) => params.value ? parseFloat(params.value).toFixed(3) : "N/A",
            width: 100 
        },
        { 
            headerName: "Buy Ratings", 
            valueGetter: (params) => {
                const stock = params.data;
                const strongBuy = parseInt(stock?.company_overview?.AnalystRatingStrongBuy || "0");
                const buy = parseInt(stock?.company_overview?.AnalystRatingBuy || "0");
                const total = (isNaN(strongBuy) ? 0 : strongBuy) + (isNaN(buy) ? 0 : buy);
                return total;
            },
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
            colId: "select",
            headerName: "Select",
            pinned: "right",
            width: 100,
            sortable: false,
            filter: false,
            cellClass: "ag-cell-action",
            headerClass: "ag-cell-action",
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
            cellRenderer: (params: CustomCellRendererProps<Stock>) => {
                const stock = params.data;
                if (!stock) return null;
                return (
                    <div className="flex items-center justify-center h-full">
                        <input
                            className="w-[20px] h-[20px] cursor-pointer accent-[#069042]"
                            type="checkbox"
                            checked={selectedSymbols.has(stock.symbol)}
                            onChange={() => {
                                // Stop propagation so row doesn't get clicked
                                toggleSelectSymbol(stock.symbol);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${stock.symbol}`}
                        />
                    </div>
                );
            }
        },
        {
            colId: "remove",
            headerName: "Remove",
            pinned: "right",
            width: 100,
            sortable: false,
            filter: false,
            cellClass: "ag-cell-action",
            headerClass: "ag-cell-action",
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
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
        }
    ], [selectedSymbols, toggleSelectSymbol, onRemove]);

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        suppressMovable: true
    }), []);

    return (
        <ControlPanel
            actionInputBar={{
                onClick: (symbol: string) => { void onAdd(symbol); },
                disabled: false,
                placeholder: "Symbol i.e. NVDA",
                buttonLabel: "Add"
            }}
            buttons={[{
                label: "Refresh",
                onClick: () => { void onRefresh(); },
                disabled: compareLoading
            }, {
                label: compareLoading ? "Comparing..." : "Compare Selected",
                onClick: onCompare,
                disabled: selectedSymbols.size < 2 || selectedSymbols.size > 10 || compareLoading
            }]}
            info={`Selected: ${selectedSymbols.size} (min 2, max 10) ${compareError ? ` - ${compareError}` : ''}${error ? ` - ${error}` : ''}`}
        >
            <div className={`ag-theme-quartz w-full`} style={{ height: 600 }}>
                <AgGridReact
                    theme={myTheme}
                    modules={[ClientSideRowModelModule, ValidationModule]}
                    rowData={stocks}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowHeight={55}
                    headerHeight={45}
                    onCellClicked={(e) => {
                        // Prevent row click navigation if clicking on Action columns
                        const colId = e.column.getColId();
                        if (colId === 'select' || colId === 'remove') {
                            return;
                        }
                        if (e.data?.symbol) {
                            onRowClick(e.data.symbol);
                        }
                    }}
                    tooltipShowDelay={0}
                />
            </div>
        </ControlPanel>
    );
};

export default StockTable;
