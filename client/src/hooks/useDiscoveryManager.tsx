import { useCallback, useRef, useState } from "react";
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

  generate: (pendingText?: string) => Promise<void>;
  addRefinement: (modifier: string) => void;
  removeRefinement: (index: number) => void;
  clearRefinements: () => void;
  goToStock: (ticker: string) => void;
  addToPortfolio: (ticker: string) => Promise<void>;
}

/**
 * Manages the client-held discovery "session". The server is stateless, so this
 * hook owns the ordered draft and sends the full list when the user searches.
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
  const searchInFlight = useRef(false);

  const generate = useCallback(async (pendingText = "") => {
    if (searchInFlight.current) return;
    searchInFlight.current = true;

    const trimmed = pendingText.trim();
    const submittedRefinements = trimmed && refinements.length < MAX_REFINEMENTS
      ? [...refinements, trimmed]
      : refinements;
    setRefinements(submittedRefinements);
    setLoading(true);
    setError(null);
    try {
      const data = await authPost<DiscoveryResponse>(DISCOVERY_ENDPOINTS.GENERATE, {
        refinements: submittedRefinements,
      });
      setRecommendations(Array.isArray(data?.recommendations) ? data.recommendations : []);
      setHasProfile(Boolean(data?.generated_from?.has_profile));
      setHasGenerated(true);
    } catch (err) {
      console.error("Discovery generate failed:", err);
      setError("Couldn't generate recommendations. Please try again.");
      setRecommendations([]);
    } finally {
      searchInFlight.current = false;
      setLoading(false);
    }
  }, [refinements]);

  const addRefinement = useCallback((modifier: string) => {
    const trimmed = modifier.trim();
    if (!trimmed || searchInFlight.current) return;
    setRefinements((draft) => draft.length < MAX_REFINEMENTS ? [...draft, trimmed] : draft);
  }, []);

  const removeRefinement = useCallback((index: number) => {
    if (searchInFlight.current) return;
    setRefinements((draft) => draft.filter((_, i) => i !== index));
  }, []);

  const clearRefinements = useCallback(() => {
    if (searchInFlight.current) return;
    setRefinements([]);
  }, []);

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
    addRefinement,
    removeRefinement,
    clearRefinements,
    goToStock,
    addToPortfolio,
  };
};
