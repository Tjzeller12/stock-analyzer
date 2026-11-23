import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisTemplateDTO } from "../../types";
import { authGet, authPut } from "../../utils/api";
import { ACTIVE_TEMPLATE_KEY, useTemplateManager } from "../useTemplateManager";

vi.mock("../../utils/api", () => ({
  authGet: vi.fn(),
  authPost: vi.fn(),
  authPut: vi.fn(),
  authDelete: vi.fn(),
}));

const radar = {
  name: "Stability First",
  scope: "global" as const,
  equations: { Valuation: "1 - pe_ratio" },
};

function starter(partial: Partial<AnalysisTemplateDTO> & Pick<AnalysisTemplateDTO, "id" | "name" | "profile_risk_tag">): AnalysisTemplateDTO {
  return {
    description: "",
    config: { radar: { ...radar, name: partial.name }, visible_columns: ["name", "price"] },
    is_default: true,
    is_owner: false,
    ...partial,
  };
}

const conservative = starter({ id: 1, name: "Stability First", profile_risk_tag: "Conservative" });
const balanced = starter({ id: 2, name: "Balanced Core", profile_risk_tag: "Balanced" });
const owned: AnalysisTemplateDTO = {
  id: 10,
  name: "My Screen",
  description: "",
  config: { radar: { ...radar, name: "My Screen" }, visible_columns: ["pe_ratio"] },
  is_default: false,
  is_owner: true,
};

describe("useTemplateManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("applies the profile-matched starter when the user has no saved templates", async () => {
    (authGet as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url.includes("/templates")) return { defaults: [conservative, balanced], mine: [] };
      if (url.includes("/investor")) return { risk_tag: "Conservative" };
      return {};
    });
    const applyView = vi.fn();
    const { result } = renderHook(() => useTemplateManager(applyView));

    await waitFor(() => expect(result.current.activeId).toBe(1));
    expect(applyView).toHaveBeenCalledWith(conservative.config.radar, ["name", "price"]);
    expect(localStorage.getItem(ACTIVE_TEMPLATE_KEY)).toBe("1");
  });

  it("prefers an owned template over the profile starter", async () => {
    (authGet as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url.includes("/templates")) return { defaults: [conservative, balanced], mine: [owned] };
      if (url.includes("/investor")) return { risk_tag: "Conservative" };
      return {};
    });
    const applyView = vi.fn();
    const { result } = renderHook(() => useTemplateManager(applyView));

    await waitFor(() => expect(result.current.activeId).toBe(10));
    expect(applyView).toHaveBeenCalledWith(owned.config.radar, ["pe_ratio"]);
  });

  it("restores the last applied template from localStorage", async () => {
    localStorage.setItem(ACTIVE_TEMPLATE_KEY, "2");
    (authGet as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url.includes("/templates")) return { defaults: [conservative, balanced], mine: [owned] };
      if (url.includes("/investor")) return { risk_tag: "Conservative" };
      return {};
    });
    const applyView = vi.fn();
    const { result } = renderHook(() => useTemplateManager(applyView));

    await waitFor(() => expect(result.current.activeId).toBe(2));
    expect(applyView).toHaveBeenCalledWith(balanced.config.radar, ["name", "price"]);
  });

  it("clearActive drops the stored id so Advanced edits are unsaved", async () => {
    (authGet as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url.includes("/templates")) return { defaults: [conservative], mine: [] };
      return { risk_tag: "Conservative" };
    });
    const { result } = renderHook(() => useTemplateManager(vi.fn()));
    await waitFor(() => expect(result.current.activeId).toBe(1));

    act(() => {
      result.current.clearActive();
    });
    expect(result.current.activeId).toBeNull();
    expect(localStorage.getItem(ACTIVE_TEMPLATE_KEY)).toBeNull();
  });

  it("updateSetup sends name and description with the scoring config", async () => {
    (authGet as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url.includes("/templates")) return { defaults: [conservative], mine: [owned] };
      return { risk_tag: "Conservative" };
    });
    (authPut as ReturnType<typeof vi.fn>).mockResolvedValue({ ...owned, name: "Renamed", description: "new notes" });
    const { result } = renderHook(() => useTemplateManager(vi.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateSetup(10, radar, ["pe_ratio"], { name: "Renamed", description: "new notes" });
    });

    expect(authPut).toHaveBeenCalledWith(
      expect.stringContaining("/templates/10"),
      expect.objectContaining({
        name: "Renamed",
        description: "new notes",
        config: { radar, visible_columns: ["pe_ratio"] },
      }),
    );
  });
});
