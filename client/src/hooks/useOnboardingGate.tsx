import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PROFILE_ENDPOINTS } from "../constants/api";
import { InvestorProfile } from "../types";
import { authGet } from "../utils/api";

/** sessionStorage flag set when the user explicitly skips/dismisses onboarding. */
export const ONBOARDING_DISMISSED_KEY = "alphabot.onboarding.dismissed";

/**
 * Soft onboarding gate. On first entry to a protected page in a session, if the
 * user has not completed onboarding (and hasn't dismissed it), redirect them to
 * /onboarding. Never blocks the app — failures and dismissals fall through (P4).
 */
export function useOnboardingGate(): void {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    if (sessionStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1") return;

    const check = async () => {
      try {
        const profile = await authGet<InvestorProfile>(PROFILE_ENDPOINTS.INVESTOR);
        if (!cancelled && !profile.onboarding_completed) {
          navigate("/onboarding", { replace: true });
        }
      } catch {
        /* never block the app on a gate failure */
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [navigate]);
}
