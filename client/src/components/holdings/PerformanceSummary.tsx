import React from "react";
import { PerformanceSummary as PerformanceSummaryData } from "../../types";

interface PerformanceSummaryProps {
  performance: PerformanceSummaryData;
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1000; // flag data older than a day (P11)

const fmtMoney = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString(undefined, { style: "currency", currency: "USD" });

const StatTile: React.FC<{ label: string; value: string; tone?: "up" | "down" | "neutral" }> = ({
  label,
  value,
  tone = "neutral",
}) => {
  const color =
    tone === "up" ? "text-primary" : tone === "down" ? "text-red-400" : "text-text-main";
  return (
    <div className="flex-1 min-w-[140px] p-3 rounded-lg bg-glass-bg border border-border-main/20">
      <p className="text-xs text-text-main/60 font-semibold uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-extrabold mt-1 ${color}`}>{value}</p>
    </div>
  );
};

/**
 * Headline performance card. All figures derive from broker cost basis (P5).
 * Surfaces a staleness flag when the last sync is old (P11).
 */
const PerformanceSummary: React.FC<PerformanceSummaryProps> = ({ performance }) => {
  const ret = performance.total_return ?? 0;
  const retPct = performance.total_return_pct ?? 0;
  const tone = ret > 0 ? "up" : ret < 0 ? "down" : "neutral";

  const lastSynced = performance.last_synced ? new Date(performance.last_synced) : null;
  const isStale = lastSynced ? Date.now() - lastSynced.getTime() > STALE_AFTER_MS : false;

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-3">
        <StatTile label="Total Value" value={fmtMoney(performance.total_value)} />
        <StatTile label="Cost Basis" value={fmtMoney(performance.total_cost_basis)} />
        <StatTile
          label="Total Return"
          value={`${ret >= 0 ? "+" : ""}${fmtMoney(ret)}`}
          tone={tone}
        />
        <StatTile
          label="Return %"
          value={`${retPct >= 0 ? "+" : ""}${retPct.toFixed(2)}%`}
          tone={tone}
        />
      </div>
      <p className="text-xs text-text-main/50 mt-2 text-left">
        {lastSynced ? (
          <>
            Last synced {lastSynced.toLocaleString()}
            {isStale && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500 font-semibold">
                Stale — sync to refresh
              </span>
            )}
          </>
        ) : (
          "Not yet synced"
        )}
      </p>
    </div>
  );
};

export default PerformanceSummary;
