import React from "react";
import { DiscoveryRecommendation } from "../../types";
import AddToListButton from "../common/AddToListButton";

interface DiscoveryCardProps {
  recommendation: DiscoveryRecommendation;
  onOpen: (ticker: string) => void;
  onAdd: (ticker: string) => Promise<void>;
}

/**
 * A single AI recommendation. The whole card opens the stock page; the ＋ button
 * adds to the portfolio via the shared add path without triggering navigation.
 */
const DiscoveryCard: React.FC<DiscoveryCardProps> = ({ recommendation, onOpen, onAdd }) => {
  const { ticker, company_name, rationale, sector } = recommendation;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(ticker)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(ticker);
      }}
      className="text-left bg-glass-bg border border-border-main/20 dark:border-white/10 rounded-xl p-4 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 hover:border-primary/40 transition-all duration-200 cursor-pointer flex flex-col gap-2 h-full"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-primary tracking-tight">{ticker}</p>
          <p className="text-sm text-text-main/70 truncate">{company_name}</p>
        </div>
        <AddToListButton symbol={ticker} onAdd={onAdd} size="sm" />
      </div>
      {sector && (
        <span className="self-start px-2 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary">
          {sector}
        </span>
      )}
      <p className="text-sm text-text-main/80 leading-snug mt-1">{rationale}</p>
    </div>
  );
};

export default DiscoveryCard;
