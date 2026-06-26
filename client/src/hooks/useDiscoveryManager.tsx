import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DISCOVERY_ENDPOINTS, PORTFOLIO_ENDPOINTS } from "../constants/api";
import { DiscoveryRecommendation, DiscoveryResponse } from "../types";
import { authPost } from "../utils/api";

// Mirror of the server-side cap (server re-sanitizes regardless) (P5).
export const MAX_REFINEMENTS = 8;

export interface UseDiscoveryManager {
  recommendations: DiscoveryRecommendation[];
  refinements: string[];
  loading: boolean;
  error: string | null;
  hasProfile: boolean;
  hasGenerated: boolean;

  generate: () => Promise<void>;
  refine: (modifier: string) => Promise<void>;
  removeRefinement: (index: number) => Promise<void>;
  clearRefinements: () => Promise<void>;
  goToStock: (ticker: string) => void;
  addToPortfolio: (ticker: string) => Promise<void>;
}

/**
 * Manages the client-held discovery "session". The server is stateless, so this
 * hook owns the ordered refinement list and resends the full list on every run.
 * `loading` is always cleared in a `finally` so skeletons never strand (P8).
 */
export const useDiscoveryManager = (): UseDiscoveryManager => {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<DiscoveryRecommendation[]>([]);
  const [refinements, setRefinements] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  /** Run discovery with an explicit refinement list (kept pure so callers control state). */
  const run = useCallback(async (nextRefinements: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const data = await authPost<DiscoveryResponse>(DISCOVERY_ENDPOINTS.GENERATE, {
        refinements: nextRefinements,
      });
      setRecommendations(Array.isArray(data?.recommendations) ? data.recommendations : []);
      setHasProfile(Boolean(data?.generated_from?.has_profile));
      setHasGenerated(true);
    } catch (err) {
      console.error("Discovery generate failed:", err);
      setError("Couldn't generate recommendations. Please try again.");
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const generate = useCallback(async () => {
    await run(refinements);
  }, [run, refinements]);

  const refine = useCallback(
    async (modifier: string) => {
      const trimmed = modifier.trim();
      if (!trimmed || loading) return;
      if (refinements.length >= MAX_REFINEMENTS) {
        setError(`You can apply at most ${MAX_REFINEMENTS} refinements.`);
        return;
      }
      const next = [...refinements, trimmed]; // append-only, order-preserving (P4)
      setRefinements(next);
      await run(next);
    },
    [run, refinements, loading]
  );

  const removeRefinement = useCallback(
    async (index: number) => {
      if (loading) return;
      const next = refinements.filter((_, i) => i !== index);
      setRefinements(next);
      await run(next);
    },
    [run, refinements, loading]
  );

  const clearRefinements = useCallback(async () => {
    if (loading) return;
    setRefinements([]);
    await run([]);
  }, [run, loading]);

  const goToStock = useCallback(
    (ticker: string) => {
      navigate(`/stock/${ticker}`);
    },
    [navigate]
  );

  // Reuses the exact same add path as the main table; adding an already-held
  // stock is a safe no-op server-side (P9, P12). Never mutates discovery results.
  const addToPortfolio = useCallback(async (ticker: string) => {
    await authPost(PORTFOLIO_ENDPOINTS.ADD, { symbol: ticker });
  }, []);

  return {
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
  };
};
