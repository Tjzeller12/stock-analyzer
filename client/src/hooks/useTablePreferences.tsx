import { useCallback, useMemo, useState } from "react";
import {
  COLUMN_REGISTRY,
  DEFAULT_VISIBLE_COLUMNS,
  TABLE_PREFS_KEY,
} from "../constants/tableColumns";

export interface TablePreferences {
  visibleColumns: string[];
}

export interface UseTablePreferences {
  visibleColumns: string[];
  isVisible: (id: string) => boolean;
  toggleColumn: (id: string) => void;
  setOrder: (ids: string[]) => void;
  resetToDefault: () => void;
}

const registryIds = new Set(COLUMN_REGISTRY.map((c) => c.id));

function sanitize(ids: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    if (!registryIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

function loadPrefs(): string[] {
  try {
    const raw = localStorage.getItem(TABLE_PREFS_KEY);
    if (!raw) return [...DEFAULT_VISIBLE_COLUMNS];
    const parsed = JSON.parse(raw) as TablePreferences;
    const cleaned = sanitize(parsed.visibleColumns ?? []);
    return cleaned.length > 0 ? cleaned : [...DEFAULT_VISIBLE_COLUMNS];
  } catch {
    return [...DEFAULT_VISIBLE_COLUMNS];
  }
}

function persist(visibleColumns: string[]) {
  localStorage.setItem(TABLE_PREFS_KEY, JSON.stringify({ visibleColumns }));
}

export function useTablePreferences(): UseTablePreferences {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => loadPrefs());

  const commit = useCallback((ids: string[]) => {
    const next = sanitize(ids);
    if (next.length === 0) return;
    setVisibleColumns(next);
    persist(next);
  }, []);

  const isVisible = useCallback(
    (id: string) => visibleColumns.includes(id),
    [visibleColumns],
  );

  const toggleColumn = useCallback(
    (id: string) => {
      const spec = COLUMN_REGISTRY.find((c) => c.id === id);
      if (!spec?.removable) return;
      if (visibleColumns.includes(id)) {
        if (visibleColumns.length <= 1) return;
        commit(visibleColumns.filter((col) => col !== id));
        return;
      }
      commit([...visibleColumns, id]);
    },
    [visibleColumns, commit],
  );

  const setOrder = useCallback(
    (ids: string[]) => {
      commit(ids);
    },
    [commit],
  );

  const resetToDefault = useCallback(() => {
    commit([...DEFAULT_VISIBLE_COLUMNS]);
  }, [commit]);

  return useMemo(
    () => ({ visibleColumns, isVisible, toggleColumn, setOrder, resetToDefault }),
    [visibleColumns, isVisible, toggleColumn, setOrder, resetToDefault],
  );
}
