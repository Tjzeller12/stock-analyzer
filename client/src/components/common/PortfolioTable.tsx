import { ColDef } from 'ag-grid-community';
import React, { useMemo } from 'react';
import { Stock } from '../../types';
import StockTableBase from './StockTableBase';
import { buildMetricColumns, positionColumns, radarColumn, selectColumn, symbolColumn } from './stockColumns';

interface PortfolioTableProps {
    stocks: Stock[];
    radarScores: Record<string, Record<string, number>>;
    selectedSymbols: Set<string>;
    toggleSelectSymbol: (symbol: string) => void;
    onRowClick: (symbol: string) => void;
    visibleColumns: string[];
    activeAxes: string[];
}

/**
 * The real, read-only "My Portfolio" table imported from a connected brokerage.
 * Adds broker position columns and drops the remove button (you can't delete a
 * real holding). Sync/disconnect controls live in its section header.
 */
const PortfolioTable: React.FC<PortfolioTableProps> = ({
    stocks,
    radarScores,
    selectedSymbols,
    toggleSelectSymbol,
    onRowClick,
    visibleColumns,
    activeAxes,
}) => {
    const columns: ColDef<Stock>[] = useMemo(() => [
        radarColumn(radarScores, activeAxes),
        symbolColumn(),
        ...positionColumns(),
        ...buildMetricColumns(visibleColumns),
        selectColumn(selectedSymbols, toggleSelectSymbol),
    ], [radarScores, activeAxes, visibleColumns, selectedSymbols, toggleSelectSymbol]);

    return <StockTableBase stocks={stocks} columns={columns} onRowClick={onRowClick} />;
};

export default PortfolioTable;
