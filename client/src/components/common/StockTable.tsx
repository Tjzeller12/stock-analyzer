import React from 'react';
import removeIcon from '../../resources/x-close-delete-svgrepo-com.svg';
import { Stock } from '../../types';
import { formatMarketCap } from '../../utils/formatters';
import ControlPanel from './ControlPanel';
import './StockTable.css';
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
    onSort: (field: string) => void;
}

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
    onSort
}) => {

    const columns: Column<Stock>[] = [
        { header: "Symbol", accessor: "symbol", className: "stock-symbol", onHeaderClick: () => onSort("symbol") },
        { header: "Name", accessor: "name", className: "stock-name", onHeaderClick: () => onSort("name") },
        { 
            header: "Price", 
            accessor: "price", 
            className: "stock-data",
            render: (stock) => `$${stock.price.toFixed(2)}`,
            onHeaderClick: () => onSort("price")
        },
        { 
            header: "EV/EBITA", 
            accessor: "ev_to_ebita", 
            className: "stock-data",
            render: (stock) => stock.ev_to_ebita.toFixed(2),
            onHeaderClick: () => onSort("ev_to_ebita")
        },
        { 
            header: "P/E Ratio", 
            accessor: "pe_ratio", 
            className: "stock-data",
            render: (stock) => stock.pe_ratio.toFixed(2),
            onHeaderClick: () => onSort("pe_ratio")
        },
        { 
            header: "Market Cap", 
            accessor: "market_cap", 
            className: "stock-data",
            render: (stock) => formatMarketCap(stock.market_cap),
            onHeaderClick: () => onSort("market_cap")
        },
        { 
            header: "Dividend", 
            accessor: "dividend_yield", 
            className: "stock-data",
            render: (stock) => `${stock.dividend_yield.toFixed(2)}%`,
            onHeaderClick: () => onSort("dividend_yield")
        },
        {
            header: "Select",
            className: "stock-action-cell",
            render: (stock) => (
                <input
                    className="action-checkbox"
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
                    className="remove-button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(stock.symbol);
                    }}
                    aria-label={`Remove ${stock.symbol}`}
                >
                    <img src={removeIcon} alt="Remove" />
                </button>
            )
        }
    ];

    return (
        <ControlPanel
            actionInputBar={{
                onClick: onAdd,
                disabled: false,
                placeholder: "Symbol i.e. NVDA",
                buttonLabel: "Add"
            }}
            buttons={[{
                label: "Refresh",
                onClick: onRefresh,
                disabled: compareLoading
            }, {
                label: compareLoading ? "Comparing..." : "Compare Selected",
                onClick: onCompare,
                disabled: selectedSymbols.size < 2 || selectedSymbols.size > 10 || compareLoading
            }]}
            info={`Selected: ${selectedSymbols.size} (min 2, max 10) ${compareError ? ` - ${compareError}` : ''}`}
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
