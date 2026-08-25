/**
 * MainPage component
 * Main dashboard for the application, displaying user's stocks, news feed, and comparison charts.
 */
import React, { useEffect, useState } from "react";
import RadarGraph from '../components/common/RadarGraph';
import StyledMarkdown from '../components/common/StyledMarkdown';
import "../utils/formatters";
// Stock interface contains data about a stock
import ActionInputBar from '../components/common/ActionInputBar';
import { DEFAULT_TEMPLATE, RadarTemplate } from '../components/common/AdvancedSettingsPanel';
import { AlphaBotResponseCard } from "../components/common/AlphaBotResponseCard";
import Card from '../components/common/Card';
import CompareControlBar from '../components/common/CompareControlBar';
import { DoughnutChart } from "../components/common/DoughnutChart";
import Header from '../components/common/Header';
import List from '../components/common/List';
import NewsListItem from '../components/common/NewsListItem';
import PortfolioTable from '../components/common/PortfolioTable';
import WatchlistTable from '../components/common/WatchlistTable';
import PerformanceSummary from '../components/holdings/PerformanceSummary';
import { NEWS_FILTER_OPTIONS } from "../constants/filters";
import { useBrokerageManager } from '../hooks/useBrokerageManager';
import { useCompareAlphaBotManager } from '../hooks/useCompareAlphaBotManager';
import { useNewsListManager } from '../hooks/useNewsListManager';
import { useOnboardingGate } from '../hooks/useOnboardingGate';
import { useStockTableManager } from '../hooks/useStockTableManager';
import { Article } from '../types';

// Shared styling for the small table-specific action buttons (Refresh / Sync),
// matching the gradient buttons used inside ControlPanel.
const TABLE_ACTION_BTN =
  "px-3 py-1.5 font-semibold text-xs rounded-md transition-all duration-200 bg-gradient-to-r from-primary to-[#057a37] text-white hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:scale-95 border border-primary/30 shadow-md";
const TABLE_ACTION_BTN_DISABLED =
  "px-3 py-1.5 font-semibold text-xs rounded-md bg-list-bg text-text-main/50 cursor-not-allowed border border-white/5 shadow-none";

// MainPage component: Serves as the dashboard for the stock analyzer application
const MainPage: React.FC = () => {

  // Soft-redirect to onboarding if the user hasn't completed it (skippable).
  useOnboardingGate();

  const [activeTemplate, setActiveTemplate] = useState<RadarTemplate>(DEFAULT_TEMPLATE);

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
  const handleCompare = () => { void compareStocks(allSelectableSymbols, activeTemplate); };

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
    // Called whenever sortBy changes
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
        // Here we use the compare endpoint as a bulk-fetch for the table stats, 
        // to avoid N round trips to the single endpoint on page load.
        // It's not *technically* compare mode, we are just borrowing the bulk capability.
        void fetchCompareRadarScores(symbols, activeTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks.length, holdings.length, activeTemplate]);

  // Main page
  return (
    <div className="flex flex-col gap-5 p-0">
      {/* Header section with title and clickable logo */}
      <Header title="AlphaBot Dashboard" />
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-5 p-5 max-w-[1800px] mx-auto w-full">
      {/* Watchlist + real portfolio live in one card under a single shared
          compare/advanced bar, so selection + comparison obviously span both. */}
      <Card title="My Stocks" variant="glass" className="col-span-1 lg:col-span-6 lg:row-start-1 w-full">
        {/* Shared controls: compare + radar template govern BOTH tables. */}
        <CompareControlBar
          selectedSymbols={selectedSymbols}
          onCompare={handleCompare}
          compareLoading={compareLoading}
          compareError={compareError}
          activeTemplate={activeTemplate}
          setActiveTemplate={setActiveTemplate}
        />

        <div className="flex flex-col gap-8 mt-4">
          {/* Watchlist — add/refresh are table-specific, so they live here. */}
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-bold uppercase tracking-wide text-text-main/70 text-left">Watchlist</h4>
              <div className="flex items-center gap-2">
                <div className="w-[240px] sm:w-[300px]">
                  <ActionInputBar
                    onClick={(symbol) => { void addStock(symbol); }}
                    disabled={false}
                    placeholder="Add symbol i.e. NVDA"
                    buttonLabel="Add"
                  />
                </div>
                <button type="button" onClick={() => { void refreshStocks(); }} className={`${TABLE_ACTION_BTN} shrink-0`}>
                  Refresh
                </button>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm text-left" role="alert">{error}</p>}
            <WatchlistTable
              stocks={stocks}
              radarScores={radarScores}
              selectedSymbols={selectedSymbols}
              toggleSelectSymbol={toggleSelectSymbol}
              onRowClick={navigateToStockPage}
              onRemove={removeStock}
            />
          </section>

          {/* My Portfolio — sync/disconnect are table-specific, so they live here. */}
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-bold uppercase tracking-wide text-text-main/70 text-left">My Portfolio</h4>
              {brokerageStatus.connected && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { void sync(); }} disabled={syncing} className={syncing ? TABLE_ACTION_BTN_DISABLED : TABLE_ACTION_BTN}>
                    {syncing ? "Syncing…" : "Sync"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { void disconnect(true); }}
                    className="text-xs font-semibold text-text-main/60 hover:text-red-400 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
            {brokerageStatus.connected ? (
              <div className="flex flex-col gap-4">
                {brokerageError && <p className="text-red-400 text-sm text-left" role="alert">{brokerageError}</p>}
                {performance && <PerformanceSummary performance={performance} />}
                <PortfolioTable
                  stocks={holdings}
                  radarScores={radarScores}
                  selectedSymbols={selectedSymbols}
                  toggleSelectSymbol={toggleSelectSymbol}
                  onRowClick={navigateToStockPage}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center border border-dashed border-border-main/30 rounded-lg">
                <p className="text-text-main/70 max-w-md">
                  Connect your brokerage to import your real positions (read-only — we never get trading access) and compare them against your watchlist.
                </p>
                <button
                  type="button"
                  onClick={() => { void startConnect(); }}
                  className="px-5 py-2 font-semibold text-sm rounded-md bg-gradient-to-r from-primary to-[#057a37] text-white hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:scale-95 border border-primary/30 shadow-md transition-all duration-200"
                >
                  Connect Brokerage
                </button>
                {brokerageError && <p className="text-red-400 text-sm" role="alert">{brokerageError}</p>}
              </div>
            )}
          </section>
        </div>
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
