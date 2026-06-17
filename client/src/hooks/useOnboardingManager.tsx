import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PROFILE_ENDPOINTS } from "../constants/api";
import {
  computeRiskScore,
  horizonTagFor,
  MAX_SECTORS,
  QUESTIONNAIRE,
  riskTagFor,
} from "../constants/onboarding";
import { HorizonTag, InvestorProfile, OnboardingDraft, RiskTag } from "../types";
import { authPut } from "../utils/api";

/** Derived-tag preview. `risk_tag` is always resolved (riskTagFor never returns null). */
export interface ProfilePreview {
  risk_tolerance_score: number;
  risk_tag: RiskTag;
  horizon_tag: HorizonTag | null;
}

const DRAFT_STORAGE_KEY = "alphabot.onboarding.draft.v1";
const DRAFT_DEBOUNCE_MS = 300;

/** A single logical step in the flow. The page renders generically from this. */
export type OnboardingStep =
  | { kind: "welcome" }
  | { kind: "question"; questionId: string }
  | { kind: "horizon" }
  | { kind: "budget" }
  | { kind: "sectors" }
  | { kind: "review" };

export interface UseOnboardingManager {
  draft: OnboardingDraft;
  steps: OnboardingStep[];
  currentStep: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;

  // mutation
  answerQuestion: (questionId: string, optionId: string) => void;
  setTimeHorizon: (years: number) => void;
  setBudget: (usd: number) => void;
  toggleSector: (key: string) => void;

  // navigation
  next: () => void;
  back: () => void;
  goToStep: (i: number) => void;

  // derivation (client mirror of server mapper — cosmetic preview only)
  previewProfile: () => ProfilePreview;

  // validation
  isStepValid: (i: number) => boolean;
  canAdvance: boolean;

  // lifecycle
  submit: () => Promise<InvestorProfile>;
  reset: () => void;

  submitting: boolean;
  error: string | null;
}

const EMPTY_DRAFT: OnboardingDraft = {
  version: 1,
  answers: {},
  timeHorizonYears: null,
  budget: null,
  selectedSectors: [],
  stepIndex: 0,
};

function buildSteps(): OnboardingStep[] {
  return [
    { kind: "welcome" },
    ...QUESTIONNAIRE.map((q): OnboardingStep => ({ kind: "question", questionId: q.id })),
    { kind: "horizon" },
    { kind: "budget" },
    { kind: "sectors" },
    { kind: "review" },
  ];
}

function loadDraft(initial?: Partial<OnboardingDraft>): OnboardingDraft {
  let stored: Partial<OnboardingDraft> | null = null;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
      if (parsed && parsed.version === 1) stored = parsed;
    }
  } catch {
    stored = null;
  }
  return { ...EMPTY_DRAFT, ...stored, ...initial };
}

/**
 * Single owner of onboarding draft state: persistence, navigation, derived-tag
 * preview, and submission. Mirrors the existing manager-hook pattern.
 */
export function useOnboardingManager(
  initial?: Partial<OnboardingDraft>
): UseOnboardingManager {
  const steps = useMemo(() => buildSteps(), []);
  const [draft, setDraft] = useState<OnboardingDraft>(() => loadDraft(initial));
  const [stepIndex, setStepIndex] = useState<number>(() =>
    Math.min(Math.max(0, draft.stepIndex ?? 0), steps.length - 1)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced persistence of the draft (including the current step) to localStorage (P3).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ ...draft, stepIndex })
        );
      } catch {
        /* storage full / unavailable — non-fatal */
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, stepIndex]);

  const answerQuestion = useCallback((questionId: string, optionId: string) => {
    setDraft((prev) => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: optionId },
    }));
  }, []);

  const setTimeHorizon = useCallback((years: number) => {
    setDraft((prev) => ({ ...prev, timeHorizonYears: years }));
  }, []);

  const setBudget = useCallback((usd: number) => {
    setDraft((prev) => ({ ...prev, budget: Number.isFinite(usd) ? Math.max(0, usd) : 0 }));
  }, []);

  const toggleSector = useCallback((key: string) => {
    setDraft((prev) => {
      const already = prev.selectedSectors.includes(key);
      if (already) {
        return { ...prev, selectedSectors: prev.selectedSectors.filter((s) => s !== key) };
      }
      if (prev.selectedSectors.length >= MAX_SECTORS) return prev; // cap enforced (P5)
      return { ...prev, selectedSectors: [...prev.selectedSectors, key] };
    });
  }, []);

  const isStepValid = useCallback(
    (i: number) => {
      const step = steps[i];
      if (!step) return false;
      switch (step.kind) {
        case "question":
          return Boolean(draft.answers[step.questionId]);
        case "horizon":
          return draft.timeHorizonYears !== null;
        case "budget":
          return draft.budget !== null && draft.budget >= 0;
        case "welcome":
        case "sectors":
        case "review":
          return true;
        default:
          return true;
      }
    },
    [steps, draft]
  );

  const canAdvance = isStepValid(stepIndex);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (!isStepValid(i)) return i; // guarded (R1)
      return Math.min(i + 1, steps.length - 1);
    });
  }, [isStepValid, steps.length]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goToStep = useCallback(
    (i: number) => {
      setStepIndex(Math.min(Math.max(0, i), steps.length - 1));
    },
    [steps.length]
  );

  const previewProfile = useCallback((): ProfilePreview => {
    const score = computeRiskScore(draft.answers);
    const risk_tag: RiskTag = riskTagFor(score);
    const horizon_tag: HorizonTag | null = horizonTagFor(draft.timeHorizonYears);
    return { risk_tolerance_score: score, risk_tag, horizon_tag };
  }, [draft]);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setDraft(EMPTY_DRAFT);
    setStepIndex(0);
    setError(null);
  }, []);

  const submit = useCallback(async (): Promise<InvestorProfile> => {
    setSubmitting(true);
    setError(null);
    try {
      const profile = await authPut<InvestorProfile>(PROFILE_ENDPOINTS.INVESTOR, {
        answers: draft.answers,
        time_horizon_years: draft.timeHorizonYears,
        budget: draft.budget,
        preferred_sectors: draft.selectedSectors,
      });
      // Clear the local draft only after a successful save (P3).
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return profile;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save your profile";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setSubmitting(false);
    }
  }, [draft]);

  return {
    draft,
    steps,
    currentStep: steps[stepIndex],
    stepIndex,
    totalSteps: steps.length,
    isFirstStep: stepIndex === 0,
    isLastStep: stepIndex === steps.length - 1,
    answerQuestion,
    setTimeHorizon,
    setBudget,
    toggleSector,
    next,
    back,
    goToStep,
    previewProfile,
    isStepValid,
    canAdvance,
    submit,
    reset,
    submitting,
    error,
  };
}
