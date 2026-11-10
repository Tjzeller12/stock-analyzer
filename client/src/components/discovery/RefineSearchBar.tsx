import React, { useState } from "react";

interface RefineSearchBarProps {
  onSubmit: (modifier: string) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  activeRefinements: string[];
  disabled?: boolean;
  atCap?: boolean;
}

/**
 * Chat-style modifier input. Submitting appends a refinement; active refinements
 * render as removable chips so the user can see (and prune) the running context.
 */
const RefineSearchBar: React.FC<RefineSearchBarProps> = ({
  onSubmit,
  onRemove,
  onClear,
  activeRefinements,
  disabled = false,
  atCap = false,
}) => {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || atCap) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          disabled={disabled || atCap}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={
            atCap
              ? "Refinement limit reached — remove one to add another"
              : 'e.g. "Exclude EV companies" or "Prefer dividend yield over 3%"'
          }
          className="tg-input flex-1 box-border px-4 py-2.5 text-sm disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || atCap || !value.trim()}
          className="tg-btn tg-btn-primary !text-sm !px-5"
        >
          Refine
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
    </div>
  );
};

export default RefineSearchBar;
