import React from "react";
import { AnalysisTemplateDTO, TemplateLibrary } from "../../types";

interface TemplateSelectorProps {
  library: TemplateLibrary;
  selectedId: number | null;
  profileRiskTag: string | null;
  onSelect: (t: AnalysisTemplateDTO) => void;
  onDelete?: (id: number) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  library,
  selectedId,
  profileRiskTag,
  onSelect,
  onDelete,
}) => {
  const all = [...library.defaults, ...library.mine];
  const selected = all.find((t) => t.id === selectedId);
  const selectedMine = selected && !selected.is_default;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    const t = all.find((row) => row.id === id);
    if (t) onSelect(t);
  };

  if (all.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label htmlFor="scoring-setup-select" className="text-xs font-semibold text-text-main whitespace-nowrap">
        Load a setup
      </label>
      <select
        id="scoring-setup-select"
        className="text-xs bg-input-bg border border-border-main rounded-md px-2 py-1.5 max-w-[260px] text-text-main"
        value={selectedId ?? ""}
        title={selected?.description ?? "Load a scoring setup into the editor"}
        onChange={handleChange}
      >
        {selectedId == null && (
          <option value="" disabled>
            Custom (unsaved)
          </option>
        )}
        {library.defaults.length > 0 && (
          <optgroup label="Defaults">
            {library.defaults.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.profile_risk_tag === profileRiskTag ? " · matches you" : ""}
              </option>
            ))}
          </optgroup>
        )}
        {library.mine.length > 0 && (
          <optgroup label="Saved">
            {library.mine.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </optgroup>
        )}
      </select>
      {selectedMine && onDelete && (
        <button
          type="button"
          onClick={() => { void onDelete(selected.id); }}
          className="text-xs font-semibold text-text-main/60 hover:text-red-400"
        >
          Delete
        </button>
      )}
    </div>
  );
};

export default TemplateSelector;
