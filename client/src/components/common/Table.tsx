import { ReactNode } from 'react';
export interface Column<T> {
  header: string;
  accessor?: keyof T;
  // Custom render function for complex cells (e.g. styling, buttons)
  render?: (item: T) => ReactNode; 
  className?: string;
  sortable?: boolean;
  onHeaderClick?: () => void;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * A highly reusable Table component strongly typed with a generic `<T>`.
 * Uses a configuration object array (`columns`) to map object properties to table cells.
 * Features built-in support for custom cell renderers, row click handlers, sorting affordances,
 * and standard empty/loading states.
 */
function Table<T>({ 
  columns, 
  data, 
  onRowClick, 
  isLoading,
  className = '',
}: TableProps<T>) {

  if (isLoading) {
    return <div className="p-4 text-center text-text-main">Loading data...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="p-4 text-center text-text-main">No data available</div>;
  }

  const thBaseClass = "text-left px-4 py-3 font-semibold uppercase text-xs tracking-wider border-b-2 border-border-main/20 bg-list-bg whitespace-nowrap transition-colors duration-200";
  const thSortableClass = "text-primary hover:bg-border-main/10 cursor-pointer";
  const rowHoverClass = "hover:bg-row-hover transition-colors";
  const rowEvenClass = "bg-even-row";

  return (
    <div className={`w-full rounded-lg overflow-hidden border border-border-main/10 shadow-sm ${className}`}>
      <div className="w-full overflow-auto max-h-[600px] [scrollbar-color:var(--scrollbar-thumb)_transparent]">
        <table className="w-full border-separate border-spacing-0 text-sm text-text-main text-left">
          <thead className="sticky top-0 z-10 shadow-sm">
            <tr>
              {columns.map((col, index) => (
                <th 
                  key={index} 
                  className={`${thBaseClass} ${col.onHeaderClick || col.sortable ? thSortableClass : ''} ${col.className || ''}`}
                  onClick={col.onHeaderClick}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, rowIndex) => (
              <tr 
                key={rowIndex} 
                className={`group last:[&>td]:border-b-0 ${rowHoverClass} ${rowIndex % 2 === 0 ? rowEvenClass : ''}`}
                onClick={() => onRowClick && onRowClick(item)}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className={`px-4 py-3 border-b border-white/5 ${col.className || ''}`}>
                    {col.render 
                      ? col.render(item) 
                      : (col.accessor ? String(item[col.accessor]) : '')
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
