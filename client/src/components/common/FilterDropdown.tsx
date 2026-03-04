import React from "react";
export interface Option {
    value: string;
    label: string;
}
export interface FilterDropProps {
  filter: string;
  setFilter: (filter: string) => void;
  options: Option[];
}

/**
 * FilterDropdown Component
 * 
 * A simple, styled `<select>` element wrapper. Used to switch between predefined options,
 * triggering a `setFilter` state update function whenever the user changes the selection.
 */
const FilterDropdown: React.FC<FilterDropProps> = ({
  filter,
  setFilter,
  options,
}) => {
  return (
      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="filter" className="text-text-main text-sm whitespace-nowrap font-medium">Filter:</label>
        <select
          id="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 min-w-[150px] bg-input-bg text-text-main rounded-lg text-sm border border-border-main/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
  );
};
export default FilterDropdown;
