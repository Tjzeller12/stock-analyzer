import React from "react";
import { MAX_SECTORS } from "../../constants/onboarding";
import { SectorInfo } from "../../types";
import SectorCard from "./SectorCard";

interface SectorMatrixProps {
  sectors: SectorInfo[];
  selected: string[]; // <= maxSelections
  onToggle: (key: string) => void;
  maxSelections?: number;
}

/** Grid of sector cards. Disables unselected cards once the cap is reached (P5). */
const SectorMatrix: React.FC<SectorMatrixProps> = ({
  sectors,
  selected,
  onToggle,
  maxSelections = MAX_SECTORS,
}) => {
  const capReached = selected.length >= maxSelections;

  return (
    <div className="text-left">
      <h2 className="text-2xl font-bold mb-2 text-text-main">
        Which sectors interest you?
      </h2>
      <p className="text-sm text-text-main/60 mb-1">
        Hover a card to see its upside and its risks. Select any that interest you.
      </p>
      <p className="text-xs text-text-main/50 mb-5">
        {selected.length} selected
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sectors.map((sector) => {
          const isSelected = selected.includes(sector.key);
          return (
            <SectorCard
              key={sector.key}
              sector={sector}
              isSelected={isSelected}
              isDisabled={capReached && !isSelected}
              onToggle={() => onToggle(sector.key)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SectorMatrix;
