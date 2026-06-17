import React from "react";

interface OnboardingProgressBarProps {
  current: number; // 0-indexed
  total: number;
  labels?: string[];
}

/** Slim progress indicator showing how far through onboarding the user is. */
const OnboardingProgressBar: React.FC<OnboardingProgressBarProps> = ({
  current,
  total,
  labels,
}) => {
  const safeTotal = Math.max(1, total);
  const pct = Math.min(100, Math.round(((current + 1) / safeTotal) * 100));
  const label = labels?.[current];

  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-center mb-2 text-xs font-semibold text-text-main/60">
        <span>{label ?? `Step ${current + 1}`}</span>
        <span>
          {current + 1} / {safeTotal}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-black/30 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-green-500 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};

export default OnboardingProgressBar;
