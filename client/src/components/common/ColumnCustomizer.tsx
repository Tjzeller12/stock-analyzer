import React, { useEffect, useRef, useState } from "react";
import { COLUMN_GROUPS, COLUMN_REGISTRY, ColumnSpec } from "../../constants/tableColumns";

interface ColumnCustomizerProps {
  registry?: ColumnSpec[];
  visibleColumns: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
}

const ColumnCustomizer: React.FC<ColumnCustomizerProps> = ({
  registry = COLUMN_REGISTRY,
  visibleColumns,
  onToggle,
  onReset,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const visible = new Set(visibleColumns);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 font-semibold text-xs rounded-md transition-all duration-200 bg-form-bg text-text-main border border-border-main/30 hover:border-primary/40 hover:text-primary"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        Columns
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Customize table columns"
          className="absolute right-0 z-50 mt-2 w-72 max-h-96 overflow-y-auto rounded-lg border border-border-main/20 bg-form-bg p-3 shadow-xl text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-text-main">Table columns</p>
            <button
              type="button"
              onClick={onReset}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Reset
            </button>
          </div>
          <p className="text-[10px] text-text-main/50 mb-3">
            Always shown: Radar, Symbol, Select. Portfolio also keeps Shares / Cost / P&amp;L.
          </p>
          {COLUMN_GROUPS.map((group) => {
            const cols = registry.filter((c) => c.group === group);
            if (cols.length === 0) return null;
            return (
              <div key={group} className="mb-3 last:mb-0">
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-text-main/50 mb-1.5">
                  {group}
                </h4>
                <ul className="flex flex-col gap-1">
                  {cols.map((col) => {
                    const checked = visible.has(col.id);
                    const lastVisible = checked && visibleColumns.length <= 1;
                    return (
                      <li key={col.id}>
                        <label className={`flex items-center gap-2 text-xs text-text-main ${lastVisible ? "opacity-60" : "cursor-pointer"}`}>
                          <input
                            type="checkbox"
                            className="accent-[#069042]"
                            checked={checked}
                            disabled={lastVisible}
                            onChange={() => onToggle(col.id)}
                          />
                          {col.header}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ColumnCustomizer;
