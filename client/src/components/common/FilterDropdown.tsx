import React from "react";
import "./FilterDropdown.css";
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
    <div className="filter-dropdown">
      <label htmlFor="filter">Filter:</label>
      <select
        id="filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="filter-dropdown-select"
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
