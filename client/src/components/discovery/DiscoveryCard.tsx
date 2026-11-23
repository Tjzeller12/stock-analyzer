import React from "react";
import { DiscoveryRecommendation } from "../../types";
import AddToListButton from "../common/AddToListButton";
import LedText, { LedDisplay } from "../common/LedText";

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
      className="tg-pane text-left p-4 cursor-pointer flex flex-col gap-3 h-full focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-center gap-3">
          <LedDisplay pitch="md" layerClassName="px-3 py-1.5 text-[22px]">
            <LedText>{ticker}</LedText>
          </LedDisplay>
          <p className="m-0 text-sm font-semibold text-text-main/80 truncate">{company_name}</p>
        </div>
        <AddToListButton symbol={ticker} onAdd={onAdd} size="sm" />
      </div>
      {sector && (
        <span className="self-start px-2 py-0.5 rounded-md text-[11px] font-mono uppercase tracking-wider bg-primary/10 text-ink-up border border-primary/20">
          {sector}
        </span>
      )}
      <p className="m-0 text-sm text-text-main/75 leading-relaxed">{rationale}</p>
    </div>
  );
};

export default DiscoveryCard;
