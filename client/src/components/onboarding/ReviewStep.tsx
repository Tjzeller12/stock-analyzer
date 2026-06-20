import React from "react";
import { SECTORS } from "../../constants/sectors";
import { HorizonTag, RiskTag } from "../../types";

interface ReviewStepProps {
  preview: {
    risk_tag: RiskTag;
    horizon_tag: HorizonTag | null;
    budget: number | null;
    preferred_sectors: string[];
  };
}

const sectorLabel = (key: string): string =>
  SECTORS.find((s) => s.key === key)?.label ?? key;

/** Final step: shows the deterministically derived tags before saving. */
const ReviewStep: React.FC<ReviewStepProps> = ({ preview }) => {
  return (
    <div className="text-left">
      <h2 className="text-2xl font-bold mb-2 text-text-main">Here's your profile</h2>
      <p className="text-sm text-text-main/60 mb-5">
        We'll use this to personalize your discovery, radar defaults, and portfolio
        suggestions. You can update it anytime from your profile.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border-main/30 bg-input-bg p-4">
          <p className="text-xs uppercase tracking-wide text-text-main/50 mb-1">
            Risk profile
          </p>
          <p className="text-xl font-bold text-primary">{preview.risk_tag}</p>
        </div>
        <div className="rounded-lg border border-border-main/30 bg-input-bg p-4">
          <p className="text-xs uppercase tracking-wide text-text-main/50 mb-1">
            Time horizon
          </p>
          <p className="text-xl font-bold text-text-main">
            {preview.horizon_tag ?? "Not set"}
          </p>
        </div>
        <div className="rounded-lg border border-border-main/30 bg-input-bg p-4">
          <p className="text-xs uppercase tracking-wide text-text-main/50 mb-1">Budget</p>
          <p className="text-xl font-bold text-text-main">
            {preview.budget !== null ? `$${preview.budget.toLocaleString()}` : "Not set"}
          </p>
        </div>
        <div className="rounded-lg border border-border-main/30 bg-input-bg p-4">
          <p className="text-xs uppercase tracking-wide text-text-main/50 mb-1">
            Preferred sectors
          </p>
          {preview.preferred_sectors.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {preview.preferred_sectors.map((key) => (
                <span
                  key={key}
                  className="px-2 py-0.5 rounded-md text-xs font-semibold bg-primary/15 text-primary"
                >
                  {sectorLabel(key)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-base font-medium text-text-main/60">None selected</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewStep;
