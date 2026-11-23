import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_VISIBLE_COLUMNS, TABLE_PREFS_KEY } from "../../constants/tableColumns";
import { useTablePreferences } from "../useTablePreferences";

describe("useTablePreferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with the deterministic default common-stats set (P10)", () => {
    const { result } = renderHook(() => useTablePreferences());
    expect(result.current.visibleColumns).toEqual(DEFAULT_VISIBLE_COLUMNS);
  });

  it("persists and restores column prefs (P6)", () => {
    const { result, unmount } = renderHook(() => useTablePreferences());
    const hidden = result.current.visibleColumns[0];

    act(() => {
      result.current.toggleColumn(hidden);
    });

    const stored = JSON.parse(localStorage.getItem(TABLE_PREFS_KEY) || "{}");
    expect(stored.visibleColumns).not.toContain(hidden);

    unmount();
    const remounted = renderHook(() => useTablePreferences());
    expect(remounted.result.current.visibleColumns).toEqual(stored.visibleColumns);
  });

  it("refuses to remove the last data column (P4)", () => {
    localStorage.setItem(TABLE_PREFS_KEY, JSON.stringify({ visibleColumns: ["price"] }));
    const { result } = renderHook(() => useTablePreferences());

    act(() => {
      result.current.toggleColumn("price");
    });

    expect(result.current.visibleColumns).toEqual(["price"]);
  });

  it("resetToDefault restores the common-stats set", () => {
    const { result } = renderHook(() => useTablePreferences());
    act(() => {
      result.current.toggleColumn("ai_moat_score");
    });
    expect(result.current.isVisible("ai_moat_score")).toBe(true);

    act(() => {
      result.current.resetToDefault();
    });
    expect(result.current.visibleColumns).toEqual(DEFAULT_VISIBLE_COLUMNS);
  });
});
