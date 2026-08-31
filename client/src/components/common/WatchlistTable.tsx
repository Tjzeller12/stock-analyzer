import { ColDef } from 'ag-grid-community';
import React, { useMemo } from 'react';
import { Stock } from '../../types';
import StockTableBase from './StockTableBase';
import { metricColumns, radarColumn, removeColumn, selectColumn, symbolColumn } from './stockColumns';

interface WatchlistTableProps {
    stocks: Stock[];
    radarScores: Record<string, Record<string, number>>;
    selectedSymbols: Set<string>;
    toggleSelectSymbol: (symbol: string) => void;
    onRowClick: (symbol: string) => void;
    onRemove: (symbol: string) => Promise<void>;
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
}) => {
    const columns: ColDef<Stock>[] = useMemo(() => [
        radarColumn(radarScores),
        symbolColumn(),
        ...metricColumns(),
        selectColumn(selectedSymbols, toggleSelectSymbol),
        removeColumn(onRemove),
    ], [radarScores, selectedSymbols, toggleSelectSymbol, onRemove]);

    return <StockTableBase stocks={stocks} columns={columns} onRowClick={onRowClick} />;
};

export default WatchlistTable;
