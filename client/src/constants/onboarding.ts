import { HorizonTag, RiskTag, ScenarioQuestion } from "../types";

/**
 * Client mirror of the server onboarding scoring config
 * (server/app/services/onboarding_config.py). The server is authoritative; these
 * values exist so the Review step can show a preview that matches the saved
 * result (see design Property P2). Keep weights in sync with the server.
 */

export const MAX_POINTS_PER_QUESTION = 30;
const NEUTRAL_POINTS = MAX_POINTS_PER_QUESTION / 2;

export const QUESTIONNAIRE: ScenarioQuestion[] = [
  {
    id: "q_market_crash",
    dimension: "risk",
    prompt: "The market just dropped 30% in a month. Your portfolio is deep red. You…",
    options: [
      { id: "buy_more", label: "Buy more — everything's on sale", weights: { risk: 30 } },
      { id: "hold", label: "Hold and wait it out", weights: { risk: 20 } },
      { id: "trim", label: "Sell some to sleep at night", weights: { risk: 10 } },
      { id: "exit", label: "Sell everything — cash is safe", weights: { risk: 0 } },
    ],
  },
  {
    id: "q_sleep_vs_moonshot",
    dimension: "risk",
    prompt: "Which describes the portfolio you actually want?",
    options: [
      { id: "moonshot", label: "Swing for moonshots, accept big swings", weights: { risk: 30 } },
      { id: "tilt_growth", label: "Mostly growth with a few safer holds", weights: { risk: 20 } },
      { id: "balanced", label: "An even balance of growth and stability", weights: { risk: 10 } },
      { id: "sleep", label: "Whatever lets me sleep at night", weights: { risk: 0 } },
    ],
  },
  {
    id: "q_windfall",
    dimension: "risk",
    prompt: "You unexpectedly receive $10,000. What happens to it?",
    options: [
      { id: "all_in", label: "Invest all of it right away", weights: { risk: 30 } },
      { id: "mostly_invest", label: "Invest most, keep a little aside", weights: { risk: 20 } },
      { id: "split", label: "Split it 50/50 invest and save", weights: { risk: 10 } },
      { id: "save_cash", label: "Mostly save it as cash", weights: { risk: 0 } },
    ],
  },
  {
    id: "q_check_frequency",
    dimension: "risk",
    prompt: "How do you imagine checking your portfolio?",
    options: [
      { id: "never_set_forget", label: "Set it and forget it for months", weights: { risk: 30 } },
      { id: "monthly", label: "A quick look every month", weights: { risk: 20 } },
      { id: "weekly", label: "Once or twice a week", weights: { risk: 10 } },
      { id: "daily_anxious", label: "Daily — I'd be anxious otherwise", weights: { risk: 0 } },
    ],
  },
  {
    id: "q_loss_tolerance",
    dimension: "risk",
    prompt: "What temporary drop could you stomach without panic-selling?",
    options: [
      { id: "down_50", label: "Down 50% — I'm in it for the long haul", weights: { risk: 30 } },
      { id: "down_30", label: "Down 30% is uncomfortable but okay", weights: { risk: 20 } },
      { id: "down_15", label: "Around 15% is my limit", weights: { risk: 10 } },
      { id: "down_0", label: "I don't want to lose principal at all", weights: { risk: 0 } },
    ],
  },
];

/** Preset time-horizon choices. `years` is the raw value persisted on the profile. */
export const HORIZON_OPTIONS: { id: string; label: string; years: number }[] = [
  { id: "short", label: "Under 2 years", years: 1 },
  { id: "medium", label: "2 – 5 years", years: 3 },
  { id: "long", label: "5 – 10 years", years: 7 },
  { id: "very_long", label: "10+ years", years: 12 },
];

export const LOW_BUDGET_THRESHOLD = 500; // USD; below this, surface index-fund guidance
// Only 7 sectors exist; allow selecting all of them (no artificial cap).
export const MAX_SECTORS = 7;

const RISK_BANDS: [number, number, RiskTag][] = [
  [0, 25, "Conservative"],
  [25, 50, "Balanced"],
  [50, 75, "Growth"],
  [75, 101, "Aggressive"],
];

/** Aggregate risk answers into a 0-100 score. Missing answers → neutral midpoint (P10). */
export function computeRiskScore(answers: Record<string, string>): number {
  let total = 0;
  for (const question of QUESTIONNAIRE) {
    if (question.dimension !== "risk") continue;
    const chosenId = answers[question.id];
    const option = question.options.find((o) => o.id === chosenId);
    total += option?.weights.risk ?? NEUTRAL_POINTS;
  }
  const riskQuestionCount = QUESTIONNAIRE.filter((q) => q.dimension === "risk").length;
  const maxTotal = riskQuestionCount * MAX_POINTS_PER_QUESTION;
  if (maxTotal <= 0) return 50;
  return Math.round((total / maxTotal) * 100 * 100) / 100;
}

export function riskTagFor(score: number): RiskTag {
  const s = Math.max(0, Math.min(100, score));
  for (const [low, high, tag] of RISK_BANDS) {
    if (s >= low && s < high) return tag;
  }
  return "Aggressive";
}

export function horizonTagFor(years: number | null): HorizonTag | null {
  if (years === null) return null;
  if (years < 2) return "Short";
  if (years < 5) return "Medium";
  if (years < 10) return "Long";
  return "Very Long";
}
