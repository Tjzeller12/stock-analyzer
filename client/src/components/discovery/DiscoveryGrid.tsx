import React from "react";
import { DiscoveryRecommendation } from "../../types";
import DiscoveryCard from "./DiscoveryCard";

interface DiscoveryGridProps {
  recommendations: DiscoveryRecommendation[];
  loading: boolean;
  skeletonCount?: number;
  onOpen: (ticker: string) => void;
  onAdd: (ticker: string) => Promise<void>;
}

const SkeletonCard: React.FC = () => (
  <div className="bg-glass-bg border border-border-main/20 dark:border-white/10 rounded-xl p-4 h-full animate-pulse flex flex-col gap-3">
    <div className="flex items-start justify-between">
      <div className="space-y-2 w-full">
        <div className="h-5 w-20 rounded bg-border-main/30" />
        <div className="h-3 w-32 rounded bg-border-main/20" />
      </div>
      <div className="h-7 w-7 rounded-full bg-border-main/20" />
    </div>
    <div className="h-4 w-24 rounded bg-border-main/20" />
    <div className="space-y-2 mt-1">
      <div className="h-3 w-full rounded bg-border-main/20" />
      <div className="h-3 w-5/6 rounded bg-border-main/20" />
    </div>
  </div>
);

/**
 * Renders exactly one of: skeletons (in flight), cards (success), or nothing
 * (the page owns the empty state). Skeletons never persist after a run because
 * the hook clears `loading` in a `finally` (P8).
 */
const DiscoveryGrid: React.FC<DiscoveryGridProps> = ({
  recommendations,
  loading,
  skeletonCount = 5,
  onOpen,
  onAdd,
}) => {
  const gridClass =
    "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full";

  if (loading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {recommendations.map((rec) => (
        <DiscoveryCard
          key={rec.ticker}
          recommendation={rec}
          onOpen={onOpen}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
};

export default DiscoveryGrid;
