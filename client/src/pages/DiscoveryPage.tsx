import React from "react";
import { Outlet, useNavigate, useOutletContext } from "react-router-dom";
import Card from "../components/common/Card";
import Header from "../components/common/Header";
import DiscoveryGrid from "../components/discovery/DiscoveryGrid";
import RefineSearchBar from "../components/discovery/RefineSearchBar";
import { MAX_REFINEMENTS, useDiscoveryManager } from "../hooks/useDiscoveryManager";
import type { UseDiscoveryManager } from "../hooks/useDiscoveryManager";

export const DiscoverySession = () => {
  const discovery = useDiscoveryManager();
  return <Outlet context={discovery} />;
};

const DiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    recommendations,
    refinements,
    loading,
    error,
    hasProfile,
    hasGenerated,
    generate,
    addRefinement,
    removeRefinement,
    clearRefinements,
    goToStock,
    addToPortfolio,
  } = useOutletContext<UseDiscoveryManager>();

  const showEmpty = hasGenerated && !loading && !error && recommendations.length === 0;

  return (
    <div className="flex flex-col p-0 text-text-main min-h-screen w-full">
      <div className="sticky top-0 z-50">
        <Header title="Tailored Discovery" />
      </div>
      <div className="flex flex-col items-center pt-5 flex-1 w-full pb-10 px-5">
        <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-6">
          <Card title="Stocks picked for you" variant="glass" live className="text-left">
            <div className="text-left mb-4">
              <p className="text-sm text-text-main/60 m-0">
                {!hasGenerated
                  ? "Search for stock ideas, with or without filters."
                  : hasProfile
                    ? "Based on your investor profile."
                    : "A general long-term starter list. Complete your profile for personalized picks."}
              </p>
              {!hasProfile && hasGenerated && (
                <button
                  type="button"
                  onClick={() => navigate("/onboarding")}
                  className="tg-btn tg-btn-primary mt-3 !text-sm !px-4 !py-2"
                >
                  Complete your profile
                </button>
              )}
            </div>

            <RefineSearchBar
              onSearch={(pendingText) => void generate(pendingText)}
              onAddFilter={addRefinement}
              onRemove={removeRefinement}
              onClear={clearRefinements}
              activeRefinements={refinements}
              disabled={loading}
              atCap={refinements.length >= MAX_REFINEMENTS}
            />
            {hasGenerated && <p className="text-xs text-text-main/60 mt-3 mb-0">Search to apply your filters.</p>}
          </Card>

          {error && (
            <div className="text-left p-3 rounded-xl border border-ink-down/30 bg-ink-down/10">
              <p className="text-sm text-ink-down m-0" role="alert">
                {error}
              </p>
            </div>
          )}

          {showEmpty ? (
            <div className="tg-pane text-center py-16">
              <p className="text-text-main/70 font-semibold">No recommendations to show.</p>
              <p className="text-sm text-text-main/50 mt-1">
                Try changing your filters and searching again.
              </p>
            </div>
          ) : (
            <DiscoveryGrid
              recommendations={recommendations}
              loading={loading}
              onOpen={goToStock}
              onAdd={addToPortfolio}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscoveryPage;
