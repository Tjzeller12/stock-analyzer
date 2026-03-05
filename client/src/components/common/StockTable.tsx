import React from 'react';
import removeIcon from '../../resources/x-close-delete-svgrepo-com.svg';
import { Stock } from '../../types';
import { formatMarketCap, formatVolume } from '../../utils/formatters';
import ControlPanel from './ControlPanel';
import Table, { Column } from './Table';

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
 * It combines the generic `Table` component with the `ControlPanel` UI to provide an 
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
    onSort
}) => {

    const columns: Column<Stock>[] = [
        { header: "Symbol", accessor: "symbol", className: "stock-symbol", onHeaderClick: () => onSort("symbol") },
        { 
            header: "Name", 
            accessor: "name", 
            className: "stock-name", 
            render: (stock) => {
                const val =stock.company_overview?.Name;
                return val ? val : "N/A";
            }, 
            onHeaderClick: () => onSort("name"), 
            sortable: true 
        },
        { 
            header: "Price", 
            accessor: "price", 
            className: "stock-data min-w-[80px]",
            render: (stock) => `$${stock.price.toFixed(2)}`,
            onHeaderClick: () => onSort("price"),
            sortable: true
        },
        { 
            header: "Market Cap", 
            accessor: "company_overview", 
            className: "stock-data min-w-[100px]",
            render: (stock) => {
                const val = stock.company_overview?.MarketCapitalization;
                return val ? formatMarketCap(parseFloat(val)) : "N/A";
            }
        },
        { 
            header: "P/E", 
            accessor: "company_overview", 
            className: "stock-data min-w-[70px]",
            render: (stock) => {
                const val = stock.company_overview?.PERatio;
                return val ? parseFloat(val).toFixed(2) : "N/A";
            }
        },
        { 
            header: "Fwd P/E", 
            accessor: "company_overview", 
            className: "stock-data min-w-[80px]",
            render: (stock) => {
                const val = stock.company_overview?.ForwardPE;
                return val ? parseFloat(val).toFixed(2) : "N/A";
            }
        },
        { 
            header: "EV/EBITDA", 
            accessor: "company_overview", 
            className: "stock-data min-w-[100px]",
            render: (stock) => {
                const val = stock.company_overview?.EVToEBITDA;
                return val ? parseFloat(val).toFixed(2) : "N/A";
            }
        },
        { 
            header: "P/S", 
            accessor: "company_overview", 
            className: "stock-data min-w-[70px]",
            render: (stock) => {
                const val = stock.company_overview?.PriceToSalesRatioTTM;
                return val ? parseFloat(val).toFixed(2) : "N/A";
            }
        },
        { 
            header: "PEG", 
            accessor: "company_overview", 
            className: "stock-data min-w-[70px]",
            render: (stock) => {
                const val = stock.company_overview?.PEGRatio;
                return val ? parseFloat(val).toFixed(3) : "N/A";
            }
        },
        { 
            header: "ROE", 
            accessor: "company_overview", 
            className: "stock-data min-w-[80px]",
            render: (stock) => {
                const val = stock.company_overview?.ReturnOnEquityTTM;
                if (!val || val === "None") return "N/A";
                const num = parseFloat(val);
                return `${(num * 100).toFixed(1)}%`;
            }
        },
        { 
            header: "Op Margin", 
            accessor: "company_overview", 
            className: "stock-data min-w-[90px]",
            render: (stock) => {
                const val = stock.company_overview?.OperatingMarginTTM;
                if (!val || val === "None") return "N/A";
                const num = parseFloat(val);
                return `${(num * 100).toFixed(1)}%`;
            }
        },
        { 
            header: "Profit Margin", 
            accessor: "company_overview", 
            className: "stock-data min-w-[100px]",
            render: (stock) => {
                const val = stock.company_overview?.ProfitMargin;
                if (!val || val === "None") return "N/A";
                const num = parseFloat(val);
                return `${(num * 100).toFixed(1)}%`;
            }
        },
        { 
            header: "Rev Growth (QoQ)", 
            accessor: "company_overview", 
            className: "stock-data min-w-[130px]",
            render: (stock) => {
                const val = stock.company_overview?.QuarterlyRevenueGrowthYOY;
                if (!val || val === "None") return "N/A";
                const num = parseFloat(val);
                return `${(num * 100).toFixed(1)}%`;
            }
        },
        { 
            header: "EPS Growth (QoQ)", 
            accessor: "company_overview", 
            className: "stock-data min-w-[130px]",
            render: (stock) => {
                const val = stock.company_overview?.QuarterlyEarningsGrowthYOY;
                if (!val || val === "None") return "N/A";
                const num = parseFloat(val);
                return `${(num * 100).toFixed(1)}%`;
            }
        },
        { 
            header: "Beta", 
            accessor: "company_overview", 
            className: "stock-data min-w-[70px]",
            render: (stock) => {
                const val = stock.company_overview?.Beta;
                return val ? parseFloat(val).toFixed(3) : "N/A";
            }
        },
        { 
            header: "Buy Ratings", 
            accessor: "company_overview", 
            className: "stock-data min-w-[100px] text-center",
            render: (stock) => {
                const strongBuy = parseInt(stock.company_overview?.AnalystRatingStrongBuy || "0");
                const buy = parseInt(stock.company_overview?.AnalystRatingBuy || "0");
                const total = (isNaN(strongBuy) ? 0 : strongBuy) + (isNaN(buy) ? 0 : buy);
                return total > 0 ? total.toString() : "N/A";
            }
        },
        {
            header: "Insider Vol", 
            accessor: "insider_volume", 
            className: "stock-data min-w-[100px]",
            render: (stock) => {
                const val = stock.insider_volume;
                return val ? formatVolume(val) : "0";
            }
        },
        {
            header: "Select",
            className: "stock-action-cell",
            render: (stock) => (
                <input
                    className="w-[25px] h-[25px] cursor-pointer accent-[#069042]"
                    type="checkbox"
                    checked={selectedSymbols.has(stock.symbol)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        e.stopPropagation();
                        toggleSelectSymbol(stock.symbol);
                    }}
                    aria-label={`Select ${stock.symbol}`}
                />
            )
        },
        {
            header: "Remove",
            className: "stock-remove-cell",
            render: (stock) => (
                <button
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 hover:shadow-md hover:shadow-red-500/20 active:scale-95 mx-auto"
                    onClick={(e) => {
                        e.stopPropagation();
                        void onRemove(stock.symbol);
                    }}
                    aria-label={`Remove ${stock.symbol}`}
                >
                    <img src={removeIcon} alt="Remove" className="w-[20px] h-[20px]" />
                </button>
            )
        }
    ];

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
            <Table 
                columns={columns} 
                data={stocks} 
                onRowClick={(stock) => onRowClick(stock.symbol)}
            />
        </ControlPanel>
    );
};

export default StockTable;
