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
