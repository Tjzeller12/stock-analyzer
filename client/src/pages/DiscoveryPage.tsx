import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/common/Header";
import DiscoveryGrid from "../components/discovery/DiscoveryGrid";
import RefineSearchBar from "../components/discovery/RefineSearchBar";
import { MAX_REFINEMENTS, useDiscoveryManager } from "../hooks/useDiscoveryManager";

/**
 * Tailored Discovery page. On mount it runs an initial generate() using the
 * user's saved profile (or a generic fallback if onboarding is incomplete).
 */
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
    refine,
    removeRefinement,
    clearRefinements,
    goToStock,
    addToPortfolio,
  } = useDiscoveryManager();

  useEffect(() => {
    void generate();
    // Run once on mount; generate is stable until refinements change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showEmpty = hasGenerated && !loading && recommendations.length === 0;

  return (
    <div className="flex flex-col p-0 font-sans bg-background text-white min-h-screen w-full">
      <Header title="Tailored Discovery" />
      <div className="flex flex-col items-center pt-[20px] flex-1 w-full pb-10 px-5">
        <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-6">
          {/* Intro / profile hint */}
          <div className="text-left">
            <h2 className="text-2xl font-extrabold text-text-main tracking-tight">
              Stocks picked for you
            </h2>
            <p className="text-sm text-text-main/60 mt-1">
              {hasProfile
                ? "Based on your investor profile. Refine the results in plain language below."
                : "A general long-term starter list. Complete your profile for personalized picks."}
            </p>
            {!hasProfile && hasGenerated && (
              <button
                type="button"
                onClick={() => navigate("/onboarding")}
                className="mt-3 px-4 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-primary to-[#057a37] text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Complete your profile
              </button>
            )}
          </div>

          {/* Refine bar */}
          <RefineSearchBar
            onSubmit={(m) => void refine(m)}
            onRemove={(i) => void removeRefinement(i)}
            onClear={() => void clearRefinements()}
            activeRefinements={refinements}
            disabled={loading}
            atCap={refinements.length >= MAX_REFINEMENTS}
          />

          {error && (
            <div className="text-left p-3 rounded-lg border border-red-400/30 bg-red-500/10">
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void generate()}
                className="mt-2 text-xs font-semibold text-primary underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          )}

          {showEmpty ? (
            <div className="text-center py-16 border border-border-main/20 rounded-xl bg-glass-bg">
              <p className="text-text-main/70 font-semibold">No recommendations to show.</p>
              <p className="text-sm text-text-main/50 mt-1">
                Try removing a refinement or generating again.
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
