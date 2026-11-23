import { ColDef } from 'ag-grid-community';
import React, { useMemo } from 'react';
import { Stock } from '../../types';
import StockTableBase from './StockTableBase';
import { buildMetricColumns, radarColumn, removeColumn, selectColumn, symbolColumn } from './stockColumns';

interface WatchlistTableProps {
    stocks: Stock[];
    radarScores: Record<string, Record<string, number>>;
    selectedSymbols: Set<string>;
    toggleSelectSymbol: (symbol: string) => void;
    onRowClick: (symbol: string) => void;
    onRemove: (symbol: string) => Promise<void>;
    visibleColumns: string[];
    activeAxes: string[];
}

/**
 * The manually-curated "Watchlist" table. Adds a remove column; add/refresh
 * controls live in its section header, compare/advanced in the shared bar.
 */
const WatchlistTable: React.FC<WatchlistTableProps> = ({
    stocks,
    radarScores,
    selectedSymbols,
    toggleSelectSymbol,
    onRowClick,
    onRemove,
    visibleColumns,
    activeAxes,
}) => {
    const columns: ColDef<Stock>[] = useMemo(() => [
        radarColumn(radarScores, activeAxes),
        symbolColumn(),
        ...buildMetricColumns(visibleColumns),
        selectColumn(selectedSymbols, toggleSelectSymbol),
        removeColumn(onRemove),
    ], [radarScores, activeAxes, visibleColumns, selectedSymbols, toggleSelectSymbol, onRemove]);

    return <StockTableBase stocks={stocks} columns={columns} onRowClick={onRowClick} />;
};

export default WatchlistTable;
