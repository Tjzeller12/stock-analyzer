/**
 * MainPage component
 * Main dashboard for the application, displaying user's stocks, news feed, and comparison charts.
 */
import React, { useEffect, useState } from "react";
import RadarGraph from '../components/common/RadarGraph';
import StyledMarkdown from '../components/common/StyledMarkdown';
import "../utils/formatters";
// Stock interface contains data about a stock
import { DEFAULT_TEMPLATE, RadarTemplate } from '../components/common/AdvancedSettingsPanel';
import { AlphaBotResponseCard } from "../components/common/AlphaBotResponseCard";
import Card from '../components/common/Card';
import { DoughnutChart } from "../components/common/DoughnutChart";
import Header from '../components/common/Header';
import List from '../components/common/List';
import NewsListItem from '../components/common/NewsListItem';
import StockTable from '../components/common/StockTable';
import { NEWS_FILTER_OPTIONS } from "../constants/filters";
import { useCompareAlphaBotManager } from '../hooks/useCompareAlphaBotManager';
import { useNewsListManager } from '../hooks/useNewsListManager';
import { useStockTableManager } from '../hooks/useStockTableManager';
import { Article } from '../types';

// MainPage component: Serves as the dashboard for the stock analyzer application
const MainPage: React.FC = () => {

  const [activeTemplate, setActiveTemplate] = useState<RadarTemplate>(DEFAULT_TEMPLATE);

  const { stocks, sortBy, radarScores, fetchStocks, fetchCompareRadarScores, addStock, removeStock, refreshStocks, navigateToStockPage, setSortBy, error } = useStockTableManager();
  const { articles, newsFilter, handleFilterChange } = useNewsListManager();
  const { compareRadarScores, selectedSymbols, compareLoading, compareError, compareResult, compareStocks, toggleSelectSymbol } = useCompareAlphaBotManager();



  useEffect(() => {
    void fetchStocks();
    void handleFilterChange("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // Called whenever sortBy changes
    void fetchStocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  useEffect(() => {
    // Fetch individual radar scores for the table whenever stocks or the template change
    const symbols = stocks.map(s => s.symbol);
    if (symbols.length > 0) {
        // Here we use the compare endpoint as a bulk-fetch for the table stats, 
        // to avoid N round trips to the single endpoint on page load.
        // It's not *technically* compare mode, we are just borrowing the bulk capability.
        void fetchCompareRadarScores(symbols, activeTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks.length, activeTemplate]);

  // Main page
  return (
    <div className="flex flex-col gap-5 p-0">
      {/* Header section with title and clickable logo */}
      <Header title="AlphaBot Dashboard" />
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-5 p-5 max-w-[1800px] mx-auto w-full">
      {/* Main content area with My Stocks and News buttons */}
      <Card title="My Stocks" variant="glass" className="col-span-1 lg:col-span-6 lg:row-start-1 w-full">
        
        {/* Stock Table */}
          <StockTable
            stocks={stocks}
            radarScores={radarScores}
            activeTemplate={activeTemplate}
            setActiveTemplate={setActiveTemplate}
            selectedSymbols={selectedSymbols}
            toggleSelectSymbol={toggleSelectSymbol}
            onRowClick={navigateToStockPage}
            onCompare={() => { void compareStocks(stocks.map(s => s.symbol), activeTemplate); }}
            onRemove={removeStock}
            onAdd={addStock}
            onRefresh={refreshStocks}
            compareLoading={compareLoading}
            compareError={compareError}
            error={error}
            onSort={setSortBy}
          />
        

      </Card>
      <Card title="News" variant="glass" className="col-span-1 lg:col-span-2 lg:row-span-2 lg:row-start-2 lg:col-start-1 w-full h-full flex flex-col">
          <List<Article> items={articles} renderItem={(article) => <NewsListItem article={article} />} 
        filterDropProp={{filter: newsFilter, setFilter: (f: string) => { void handleFilterChange(f); }, options: NEWS_FILTER_OPTIONS}}/>
      </Card>
      {/* Comparison result */}
      <Card title="Comparison Analysis" variant="glass" className="col-span-1 lg:col-span-2 lg:row-span-2 lg:row-start-2 lg:col-start-3 w-full">
        {(compareResult || compareLoading) && (
            <AlphaBotResponseCard isLoading={compareLoading} className="min-h-[400px]">
                 {compareResult && (
                    <>
                        <div className="text-left overflow-y-auto h-full max-h-[900px] pr-4 [scrollbar-color:var(--scrollbar-thumb)_transparent]">
                        <StyledMarkdown>{compareResult.analysis}</StyledMarkdown>
                        </div>
                    </>
                 )}
            </AlphaBotResponseCard>
        )}  
      </Card>
      <Card title="Compare Radar Graph" variant="glass" className="col-span-1 lg:col-start-5 lg:col-span-2 lg:row-start-2 w-full flex justify-center items-center">
        {(compareRadarScores || compareLoading) && (
            <AlphaBotResponseCard isLoading={compareLoading && !compareRadarScores}>
            {compareRadarScores && (
                    <>
                        <div className="w-full h-full flex justify-center items-center">
                        <RadarGraph data={compareRadarScores}/>
                        </div>

                    </>
                 )}
            </AlphaBotResponseCard>
        )}
      </Card>
      <Card title="Portfolio Distribution Chart" variant="glass" className="col-span-1 lg:col-start-5 lg:col-span-2 lg:row-start-3 w-full flex justify-center items-center">
        {(compareResult || compareLoading) && (
          <AlphaBotResponseCard isLoading={compareLoading}>
            {compareResult && compareResult.doughnutChartData && (
              <>
                <div className="w-full h-full max-h-[500px] max-w-[500px] flex justify-center items-center mx-auto">
                  <DoughnutChart data={compareResult.doughnutChartData}/>
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
