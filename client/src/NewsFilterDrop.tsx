import React from 'react';
import './NewsFilterDrop.css';

interface NewsFilterDropProps {
    filter: string;
    setFilter: (filter: string) => void;
}

const NewsFilterDrop: React.FC<NewsFilterDropProps> = ({ filter, setFilter }) => {
    return (
        <div className="filter-container">
            <label htmlFor="filter">Filter:</label>
            <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
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