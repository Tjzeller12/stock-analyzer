import React, { ReactNode } from "react";
import { PerformanceSummary as PerformanceSummaryData, Stock } from "../../types";
import StockSearchInput from "./StockSearchInput";
import { RadarTemplate } from "./AdvancedSettingsPanel";
import Card from "./Card";
import CompareControlBar from "./CompareControlBar";
import PortfolioTable from "./PortfolioTable";
import WatchlistTable from "./WatchlistTable";
import PerformanceSummary from "../holdings/PerformanceSummary";

const TABLE_ACTION_BTN =
  "px-3 py-1.5 font-semibold text-xs rounded-md transition-all duration-200 bg-gradient-to-r from-primary to-[#057a37] text-white hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:scale-95 border border-primary/30 shadow-md";
const TABLE_ACTION_BTN_DISABLED =
  "px-3 py-1.5 font-semibold text-xs rounded-md bg-list-bg text-text-main/50 cursor-not-allowed border border-white/5 shadow-none";

interface SectionHeaderProps {
  title: string;
  actions?: ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, actions }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h4 className="text-sm font-bold uppercase tracking-wide text-text-main/70 text-left">{title}</h4>
    {actions}
  </div>
);

interface StocksCardProps {
  radarScores: Record<string, Record<string, number>>;
  selectedSymbols: Set<string>;
  toggleSelectSymbol: (symbol: string) => void;
  onRowClick: (symbol: string) => void;
  onCompare: () => void;
  compareLoading: boolean;
  compareError: string | null;
  activeTemplate: RadarTemplate;
  setActiveTemplate: (template: RadarTemplate) => void;

  watchlist: Stock[];
  watchlistError: string | null;
  onAdd: (symbol: string) => Promise<void>;
  onRemove: (symbol: string) => Promise<void>;
  onRefresh: () => Promise<void>;

  holdings: Stock[];
  connected: boolean;
  syncing: boolean;
  brokerageError: string | null;
  performance: PerformanceSummaryData | null;
  onSync: () => void;
  onDisconnect: () => void;
  onConnect: () => void;

  visibleColumns: string[];
  onToggleColumn: (id: string) => void;
  onResetColumns: () => void;
  activeAxes: string[];
}

/**
 * The dashboard "My Stocks" card: one shared compare/advanced bar over the
 * watchlist and the real brokerage portfolio.
 */
const StocksCard: React.FC<StocksCardProps> = ({
  radarScores,
  selectedSymbols,
  toggleSelectSymbol,
  onRowClick,
  onCompare,
  compareLoading,
  compareError,
  activeTemplate,
  setActiveTemplate,
  watchlist,
  watchlistError,
  onAdd,
  onRemove,
  onRefresh,
  holdings,
  connected,
  syncing,
  brokerageError,
  performance,
  onSync,
  onDisconnect,
  onConnect,
  visibleColumns,
  onToggleColumn,
  onResetColumns,
  activeAxes,
}) => {
  const sharedTable = {
    radarScores,
    selectedSymbols,
    toggleSelectSymbol,
    onRowClick,
    visibleColumns,
    activeAxes,
  };

  return (
    <Card title="My Stocks" variant="glass" className="col-span-1 lg:col-span-6 lg:row-start-1 w-full">
      <CompareControlBar
        selectedSymbols={selectedSymbols}
        onCompare={onCompare}
        compareLoading={compareLoading}
        compareError={compareError}
        activeTemplate={activeTemplate}
        setActiveTemplate={setActiveTemplate}
        visibleColumns={visibleColumns}
        onToggleColumn={onToggleColumn}
        onResetColumns={onResetColumns}
      />

      <div className="flex flex-col gap-8 mt-4">
        <section className="flex flex-col gap-2">
          <SectionHeader
            title="Watchlist"
            actions={
              <div className="flex items-center gap-2">
                <div className="w-[240px] sm:w-[300px]">
                  <StockSearchInput onStockSelect={(symbol) => { void onAdd(symbol); }} />
                </div>
                <button type="button" onClick={() => { void onRefresh(); }} className={`${TABLE_ACTION_BTN} shrink-0`}>
                  Refresh
                </button>
              </div>
            }
          />
          {watchlistError && <p className="text-red-400 text-sm text-left" role="alert">{watchlistError}</p>}
          <WatchlistTable stocks={watchlist} onRemove={onRemove} {...sharedTable} />
        </section>

        <section className="flex flex-col gap-2">
          <SectionHeader
            title="My Portfolio"
            actions={connected ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={onSync} disabled={syncing} className={syncing ? TABLE_ACTION_BTN_DISABLED : TABLE_ACTION_BTN}>
                  {syncing ? "Syncing…" : "Sync"}
                </button>
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="text-xs font-semibold text-text-main/60 hover:text-red-400 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : undefined}
          />
          {connected ? (
            <div className="flex flex-col gap-4">
              {brokerageError && <p className="text-red-400 text-sm text-left" role="alert">{brokerageError}</p>}
              {performance && <PerformanceSummary performance={performance} />}
              <PortfolioTable stocks={holdings} {...sharedTable} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center border border-dashed border-border-main/30 rounded-lg">
              <p className="text-text-main/70 max-w-md">
                Connect your brokerage to import your real positions (read-only — we never get trading access) and compare them against your watchlist.
              </p>
              <button
                type="button"
                onClick={onConnect}
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
  );
};

export default StocksCard;
