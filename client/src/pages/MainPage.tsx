/**
 * MainPage component
 * Main dashboard for the application, displaying user's stocks, news feed, and comparison charts.
 */
import React, { useEffect, useState } from "react";
import RadarGraph from '../components/common/RadarGraph';
import StyledMarkdown from '../components/common/StyledMarkdown';
import "../utils/formatters";
import { DEFAULT_TEMPLATE, RadarTemplate } from '../components/common/AdvancedSettingsPanel';
import { AlphaBotResponseCard } from "../components/common/AlphaBotResponseCard";
import Card from '../components/common/Card';
import { DoughnutChart } from "../components/common/DoughnutChart";
import Header from '../components/common/Header';
import List from '../components/common/List';
import NewsListItem from '../components/common/NewsListItem';
import StocksCard from '../components/common/StocksCard';
import { NEWS_FILTER_OPTIONS } from "../constants/filters";
import { useBrokerageManager } from '../hooks/useBrokerageManager';
import { useCompareAlphaBotManager } from '../hooks/useCompareAlphaBotManager';
import { useNewsListManager } from '../hooks/useNewsListManager';
import { useOnboardingGate } from '../hooks/useOnboardingGate';
import { useStockTableManager } from '../hooks/useStockTableManager';
import { useTablePreferences } from '../hooks/useTablePreferences';
import { Article } from '../types';
import { activeAxes } from '../utils/radarTemplate';

const MainPage: React.FC = () => {
  useOnboardingGate();

  const [activeTemplate, setActiveTemplate] = useState<RadarTemplate>(DEFAULT_TEMPLATE);
  const { visibleColumns, toggleColumn, resetToDefault } = useTablePreferences();

  const { stocks, sortBy, radarScores, fetchStocks, fetchCompareRadarScores, addStock, removeStock, refreshStocks, navigateToStockPage, error } = useStockTableManager();
  const { articles, newsFilter, handleFilterChange } = useNewsListManager();
  const { compareRadarScores, selectedSymbols, compareLoading, compareError, compareResult, compareStocks, toggleSelectSymbol } = useCompareAlphaBotManager();
  const {
    status: brokerageStatus,
    holdings,
    performance,
    syncing,
    error: brokerageError,
    fetchHoldings,
    startConnect,
    sync,
    disconnect,
  } = useBrokerageManager();

  // Compare works across both tables. Selection is a shared symbol set, so passing
  // the union of both tables' symbols dedupes automatically (e.g. TSLA in both = one).
  const allSelectableSymbols = [
    ...stocks.map(s => s.symbol),
    ...holdings.map(h => h.symbol),
  ];
  const handleCompare = () => {
    document.getElementById("compare-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    void compareStocks(allSelectableSymbols, activeTemplate);
  };

  const compareActive = Boolean(compareLoading || compareRadarScores || compareResult);

  useEffect(() => {
    void fetchStocks();
    void handleFilterChange("all");
    void fetchHoldings();
    // Returning from the brokerage connection portal → finalize with a sync.
    if (new URLSearchParams(window.location.search).get("connected") === "1") {
      void sync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void fetchStocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy]);

  useEffect(() => {
    // Bulk-fetch radar scores for BOTH tables' symbols (deduped) whenever either
    // table's contents or the template change, so radar renders identically.
    const symbols = Array.from(new Set([
      ...stocks.map(s => s.symbol),
      ...holdings.map(h => h.symbol),
    ]));
    if (symbols.length > 0) {
        void fetchCompareRadarScores(symbols, activeTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks.length, holdings.length, activeTemplate]);

  return (
    <div className="flex flex-col gap-5 p-0">
      <Header title="AlphaBot Dashboard" />
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-5 p-5 max-w-[1800px] mx-auto w-full">
      <StocksCard
        radarScores={radarScores}
        selectedSymbols={selectedSymbols}
        toggleSelectSymbol={toggleSelectSymbol}
        onRowClick={navigateToStockPage}
        onCompare={handleCompare}
        compareLoading={compareLoading}
        compareError={compareError}
        activeTemplate={activeTemplate}
        setActiveTemplate={setActiveTemplate}
        watchlist={stocks}
        watchlistError={error}
        onAdd={addStock}
        onRemove={removeStock}
        onRefresh={refreshStocks}
        holdings={holdings}
        connected={brokerageStatus.connected}
        syncing={syncing}
        brokerageError={brokerageError}
        performance={performance}
        onSync={() => { void sync(); }}
        onDisconnect={() => { void disconnect(true); }}
        onConnect={() => { void startConnect(); }}
        visibleColumns={visibleColumns}
        onToggleColumn={toggleColumn}
        onResetColumns={resetToDefault}
        activeAxes={activeAxes(activeTemplate)}
      />

      <Card title="News" variant="glass" className="col-span-1 lg:col-span-2 lg:row-span-2 lg:row-start-2 lg:col-start-1 w-full h-full flex flex-col">
          <List<Article> items={articles} renderItem={(article) => <NewsListItem article={article} />} 
        filterDropProp={{filter: newsFilter, setFilter: (f: string) => { void handleFilterChange(f); }, options: NEWS_FILTER_OPTIONS}}/>
      </Card>
      <div id="compare-results" className="col-span-1 lg:col-span-6 lg:col-start-1 h-0 overflow-hidden" aria-hidden="true" />
      {compareActive && (
        <div className="contents">
          <Card title="Compare Radar Graph" variant="glass" className="col-span-1 lg:col-start-3 lg:col-span-2 lg:row-start-2 w-full flex justify-center items-center">
            <AlphaBotResponseCard isLoading={!compareRadarScores} className="w-full">
              {compareRadarScores && (
                <div className="w-full h-full flex justify-center items-center">
                  <RadarGraph data={compareRadarScores}/>
                </div>
              )}
            </AlphaBotResponseCard>
          </Card>
          <Card title="Portfolio Distribution Chart" variant="glass" className="col-span-1 lg:col-start-5 lg:col-span-2 lg:row-start-2 w-full flex justify-center items-center">
            <AlphaBotResponseCard isLoading={!compareResult?.doughnutChartData} className="w-full">
              {compareResult?.doughnutChartData && (
                <div className="w-full h-full max-h-[500px] max-w-[500px] flex justify-center items-center mx-auto">
                  <DoughnutChart data={compareResult.doughnutChartData}/>
                </div>
              )}
            </AlphaBotResponseCard>
          </Card>
          <Card title="Comparison Analysis" variant="glass" className="col-span-1 lg:col-span-4 lg:col-start-3 lg:row-start-3 w-full">
            <AlphaBotResponseCard isLoading={compareLoading && !compareResult} className="min-h-[400px]">
              {compareResult && (
                <div className="text-left overflow-y-auto h-full max-h-[900px] pr-4 [scrollbar-color:var(--scrollbar-thumb)_transparent]">
                  <StyledMarkdown>{compareResult.analysis}</StyledMarkdown>
                </div>
              )}
            </AlphaBotResponseCard>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
};

export default MainPage;
