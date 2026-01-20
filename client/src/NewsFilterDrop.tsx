import React from "react";
import "./NewsFilterDrop.css";

interface NewsFilterDropProps {
  filter: string;
  setFilter: (filter: string) => void;
}

const NewsFilterDrop: React.FC<NewsFilterDropProps> = ({
  filter,
  setFilter,
}) => {
  return (
    <div className="news-filter">
      <label htmlFor="filter">Filter:</label>
      <select
        id="filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="news-filter-select"
      >
        <option value="all">All News</option>
        <option value="blockchain">Blockchain</option>
        <option value="earnings">Earnings</option>
        <option value="ipo">IPO</option>
        <option value="mergers_and_acquisitions">Mergers & Acquisitions</option>
        <option value="financial_markets">Financial Markets</option>
        <option value="economy_fiscal">Economy - Fiscal Policy</option>
        <option value="economy_monetary">Economy - Monetary Policy</option>
        <option value="economy_macro">Economy - Macro/Overall</option>
        <option value="energy_transportation">Energy & Transportation</option>
        <option value="finance">Finance</option>
        <option value="life_sciences">Life Sciences</option>
        <option value="manufacturing">Manufacturing</option>
        <option value="real_estate">Real Estate & Construction</option>
        <option value="retail_wholesale">Retail & Wholesale</option>
        <option value="technology">Technology</option>
      </select>
    </div>
  );
};
export default NewsFilterDrop;
