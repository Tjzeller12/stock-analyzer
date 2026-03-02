import { ReactNode } from 'react';
import './Table.css';

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
    return <div className="start-table-loading">Loading data...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="start-table-empty">No data available</div>;
  }

  return (
    <div className={`start-table-container ${className}`}>
      <table className="start-table">
        <thead>
          <tr>
            {columns.map((col, index) => (
              <th 
                key={index} 
                className={`${col.className || ''} ${col.onHeaderClick || col.sortable ? 'sortable' : ''}`}
                onClick={col.onHeaderClick}
                style={(col.onHeaderClick || col.sortable) ? { cursor: 'pointer' } : undefined}
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
              className={rowIndex % 2 !== 0 ? 'odd' : 'even'}
              onClick={() => onRowClick && onRowClick(item)}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} className={col.className}>
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
  );
}

export default Table;
