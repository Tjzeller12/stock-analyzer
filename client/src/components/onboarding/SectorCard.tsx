import React, { useState } from "react";
import { SectorInfo } from "../../types";

interface SectorCardProps {
  sector: SectorInfo;
  isSelected: boolean;
  isDisabled: boolean; // true when max reached and not already selected
  onToggle: () => void;
}

/**
 * A selectable sector tile that expands on hover/focus/tap to reveal its
 * "Pitch" (pros) and "Reality Check" (cons).
 */
const SectorCard: React.FC<SectorCardProps> = ({
  sector,
  isSelected,
  isDisabled,
  onToggle,
}) => {
  const [expanded, setExpanded] = useState(false);
  const showDetails = expanded || isSelected;

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`rounded-xl border p-4 text-left transition-all duration-200 ${
        isSelected
          ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
          : isDisabled
          ? "border-border-main/20 bg-input-bg/40 opacity-50"
          : "border-border-main/30 bg-input-bg hover:border-text-main/40"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
        disabled={isDisabled && !isSelected}
        aria-pressed={isSelected}
        className="w-full flex items-center justify-between gap-2 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2">
          {sector.icon && <span className="text-xl">{sector.icon}</span>}
          <span className="font-bold text-text-main">{sector.label}</span>
        </span>
        <span
          className={`flex-none w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs ${
            isSelected ? "border-primary bg-primary text-white" : "border-text-main/40"
          }`}
        >
          {isSelected ? "✓" : ""}
        </span>
      </button>

      {showDetails && (
        <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
          <div>
            <p className="font-semibold text-primary mb-1">The Pitch</p>
            <ul className="list-disc list-inside text-text-main/70 space-y-0.5">
              {sector.pitch.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-red-400 mb-1">Reality Check</p>
            <ul className="list-disc list-inside text-text-main/70 space-y-0.5">
              {sector.realityCheck.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectorCard;
