import React from "react";
import { LOW_BUDGET_THRESHOLD } from "../../constants/onboarding";

interface BudgetStepProps {
  value: number | null;
  onChange: (usd: number) => void;
}

const QUICK_AMOUNTS = [100, 500, 2500, 10000];

/**
 * Captures the user's investable budget. Surfaces broad-index-fund guidance when
 * the amount is below the low-budget threshold (feeds the deterministic-portfolio
 * feature later).
 */
const BudgetStep: React.FC<BudgetStepProps> = ({ value, onChange }) => {
  const showLowBudgetHint = value !== null && value > 0 && value < LOW_BUDGET_THRESHOLD;

  return (
    <div className="text-left">
      <h2 className="text-2xl font-bold mb-2 text-text-main">
        What's your starting budget?
      </h2>
      <p className="text-sm text-text-main/60 mb-5">
        We'll prioritize recommendations that fit your price range. You can change this anytime.
      </p>

      <div className="relative mb-4">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/60 text-lg font-semibold">
          $
        </span>
        <input
          type="number"
          min={0}
          step={50}
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }}
          placeholder="0"
          className="w-full box-border pl-9 pr-4 py-3 text-lg border border-border-main rounded-lg bg-input-bg text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => onChange(amt)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
              value === amt
                ? "border-primary bg-primary/10 text-primary"
                : "border-border-main/30 bg-input-bg text-text-main/70 hover:border-text-main/40"
            }`}
          >
            ${amt.toLocaleString()}
          </button>
        ))}
      </div>

      {showLowBudgetHint && (
        <div className="mt-2 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-200/90">
          <span className="font-semibold">Starting small?</span> With a budget under $
          {LOW_BUDGET_THRESHOLD.toLocaleString()}, a broad index fund (like one tracking the
          S&amp;P 500) is often a smart, diversified first move. We'll keep that in mind.
        </div>
      )}
    </div>
  );
};

export default BudgetStep;
