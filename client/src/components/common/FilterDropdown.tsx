import React, { useState, useRef, useEffect } from "react";

export interface Option {
    value: string;
    label: string;
}
export interface FilterDropProps {
  filter: string;
  setFilter: (filter: string) => void;
  options: Option[];
}

/**
 * FilterDropdown Component
 *
 * Custom dropdown (replaces native <select>) so option items respect the app's
 * CSS-variable-based dark/light theme. Native <option> popups use OS colors and
 * ignore CSS, producing invisible white-on-white text in dark mode.
 */
const FilterDropdown: React.FC<FilterDropProps> = ({ filter, setFilter, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === filter)?.label ?? filter;

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="text-text-main text-sm whitespace-nowrap font-medium">Filter:</label>
      <div ref={ref} className="relative min-w-[150px]">
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-form-bg text-text-main rounded-md text-sm border border-border-main/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner"
        >
          <span className="truncate">{selectedLabel}</span>
          <svg
            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 10 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Dropdown panel */}
        {open && (
          <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border-main/20 bg-form-bg shadow-lg py-1">
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => { setFilter(option.value); setOpen(false); }}
                className={`px-3 py-1.5 text-sm cursor-pointer transition-colors
                  ${option.value === filter
                    ? "bg-primary/20 text-primary font-medium"
                    : "text-text-main hover:bg-border-main/10"
                  }`}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FilterDropdown;
