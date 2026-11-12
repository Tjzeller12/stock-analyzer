import React, { useState } from "react";

interface RefineSearchBarProps {
  onSearch: (pendingText: string) => void;
  onAddFilter: (modifier: string) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  activeRefinements: string[];
  disabled?: boolean;
  atCap?: boolean;
}

/**
 * Edits the draft filters and submits them when the user searches.
 */
const RefineSearchBar: React.FC<RefineSearchBarProps> = ({
  onSearch,
  onAddFilter,
  onRemove,
  onClear,
  activeRefinements,
  disabled = false,
  atCap = false,
}) => {
  const [value, setValue] = useState("");

  const addFilter = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || atCap) return;
    onAddFilter(trimmed);
    setValue("");
  };

  return (
    <form
      className="w-full flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        onSearch(atCap ? "" : value);
        setValue("");
      }}
    >
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          aria-label="Search instructions (optional)"
          value={value}
          disabled={disabled || atCap}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            atCap
              ? "Refinement limit reached — remove one to add another"
              : 'e.g. "Exclude EV companies" or "Prefer dividend yield over 3%"'
          }
          className="tg-input min-w-0 flex-1 basis-full sm:basis-auto box-border px-4 py-2.5 text-sm disabled:opacity-60"
        />
        <button
          type="button"
          onClick={addFilter}
          disabled={disabled || atCap || !value.trim()}
          className="tg-btn !text-sm !px-5"
        >
          Add filter
        </button>
        <button type="submit" disabled={disabled} className="tg-btn tg-btn-primary !text-sm !px-5">
          Search
        </button>
      </div>

      {activeRefinements.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeRefinements.map((r, i) => (
            <span
              key={`${r}-${i}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-ink-up border border-primary/25"
            >
              {r}
              <button
                type="button"
                onClick={() => onRemove(i)}
                disabled={disabled}
                aria-label={`Remove refinement: ${r}`}
                className="text-ink-up/70 hover:text-ink-up font-bold leading-none disabled:opacity-50"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-xs font-semibold text-text-main/60 hover:text-text-main underline underline-offset-2 disabled:opacity-50"
          >
            Clear all
          </button>
        </div>
      )}
    </form>
  );
};

export default RefineSearchBar;
