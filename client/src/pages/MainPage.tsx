import React, { useEffect } from "react";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import RadarGraph from '../components/common/RadarGraph';
import "../main.css";
import "../utils/formatters";
// Stock interface contains data about a stock
import { AlphaBotResponseCard } from "../components/common/AlphaBotResponseCard";
import Card from '../components/common/Card';
import Header from '../components/common/Header';
import List from '../components/common/List';
import NewsListItem from '../components/common/NewsListItem';
import StockTable from '../components/common/StockTable';
import { NEWS_FILTER_OPTIONS } from "../constants/filters";
import { useCompareAlphaBotManager } from '../hooks/useCompareAlphaBotManager';
import { useNewsListManager } from '../hooks/useNewsListManager';
import { useStockTableManager } from '../hooks/useStockTableManager';
import { Article } from '../types';
import "./MainPage.css";

// MainPage component: Serves as the dashboard for the stock analyzer application
const MainPage: React.FC = () => {

  const { stocks, sortBy, fetchStocks, addStock, removeStock, refreshStocks, navigateToStockPage, setSortBy } = useStockTableManager();
  const { articles, newsFilter, handleFilterChange } = useNewsListManager();
  const { selectedSymbols, compareLoading, compareError, compareResult, compareStocks, toggleSelectSymbol } = useCompareAlphaBotManager();



  useEffect(() => {
    fetchStocks();
    handleFilterChange("All");
  }, []);
  useEffect(() => {
    // Called whenever sortBy changes
    fetchStocks();
  }, [sortBy]);
  useEffect(() => {
    // Called whenever newsFilter changes
    handleFilterChange(newsFilter);
  }, [newsFilter]);

  // Main page
  return (
    <div className="main-container">
      {/* Header section with title and clickable logo */}
      <Header title="AlphaBot Dashboard" />
      <div className="main-content">
      {/* Main content area with My Stocks and News buttons */}
      <Card title="My Stocks" variant="glass" className="stock-table-container">
        
        {/* Stock Table */}
          <StockTable
            stocks={stocks}
            selectedSymbols={selectedSymbols}
            toggleSelectSymbol={toggleSelectSymbol}
            onRowClick={navigateToStockPage}
            onCompare={compareStocks}
            onRemove={removeStock}
            onAdd={addStock}
            onRefresh={refreshStocks}
            compareLoading={compareLoading}
            compareError={compareError}
            onSort={setSortBy}
          />
        

      </Card>
      <Card title="News" variant="glass" className="news-container">
          <List<Article> items={articles} renderItem={(article) => <NewsListItem article={article} />} 
        filterDropProp={{filter: newsFilter, setFilter: handleFilterChange, options: NEWS_FILTER_OPTIONS}}/>
      </Card>
      {/* Comparison result */}
      <Card title="Comparison Analysis" variant="glass" className="compare-result-container">
        {(compareResult || compareLoading) && (
            <AlphaBotResponseCard isLoading={compareLoading}>
                 {compareResult && (
                    <>
                        <div className="analysis-body">
                        <Markdown remarkPlugins={[remarkGfm]}>{compareResult.analysis}</Markdown>
                        </div>
                    </>
                 )}
            </AlphaBotResponseCard>
        )}  
      </Card>
      <Card title="Compare Radar Graph" variant="glass" className="compare-radar-chart-container">
        {(compareResult || compareLoading) && (
            <AlphaBotResponseCard isLoading={compareLoading}>
                 {compareResult && (
                    <>
                        <div className="compare-radar-chart-container">
                        <RadarGraph data={compareResult.radarChartData}/>
                        </div>

                    </>
                 )}
            </AlphaBotResponseCard>
        )}
      </Card>
      </div>
    </div>
  );
};

export default MainPage;
