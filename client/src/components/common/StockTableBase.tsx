import { ClientSideRowModelModule, ColDef, TooltipModule, ValidationModule, themeQuartz } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import React, { useContext, useMemo } from 'react';
import { ThemeContext } from '../../ThemeContext';
import { Stock } from '../../types';

export interface StockTableBaseProps {
    stocks: Stock[];
    /** Fully-composed columns for this particular table (see stockColumns). */
    columns: ColDef<Stock>[];
    onRowClick: (symbol: string) => void;
}

/**
 * StockTableBase
 *
 * The presentational AG Grid shell shared by every stock table. It renders
 * whatever columns it's handed and nothing else — no controls, no variant flag.
 * Table-specific actions live with each table (WatchlistTable / PortfolioTable /
 * MainPage), and the shared compare/advanced controls live in CompareControlBar.
 */
const StockTableBase: React.FC<StockTableBaseProps> = ({ stocks, columns, onRowClick }) => {
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

    const defaultColDef = useMemo(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        suppressMovable: true
    }), []);

    return (
        <div className={`ag-theme-quartz w-full`} style={{ height: 600 }}>
            <AgGridReact
                theme={myTheme}
                modules={[ClientSideRowModelModule, ValidationModule, TooltipModule]}
                rowData={stocks}
                columnDefs={columns}
                defaultColDef={defaultColDef}
                rowHeight={45}
                headerHeight={36}
                onCellClicked={(e) => {
                    // Action columns handle their own clicks; don't navigate.
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
    );
};

export default StockTableBase;
