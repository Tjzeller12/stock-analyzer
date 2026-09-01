import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE } from "../../components/common/AdvancedSettingsPanel";
import { addAxis, disableAxis, enableAxis, NEUTRAL_AXIS_EQUATION, removeAxis, uniqueAxisName } from "../radarTemplate";

describe("radarTemplate", () => {
  it("adds a neutral axis that cannot yield NaN (P8)", () => {
    const next = addAxis(DEFAULT_TEMPLATE, "Focus");
    expect(next.equations.Focus).toBe(NEUTRAL_AXIS_EQUATION);
    expect(Number(NEUTRAL_AXIS_EQUATION)).toBe(50);
    expect(Number.isFinite(Number(next.equations.Focus))).toBe(true);
  });

  it("removing an axis leaves the remaining equations unchanged (P2)", () => {
    const valuation = DEFAULT_TEMPLATE.equations.Valuation;
    const next = removeAxis(DEFAULT_TEMPLATE, "Growth");
    expect(next.equations.Growth).toBeUndefined();
    expect(next.equations.Valuation).toBe(valuation);
    expect(Object.keys(next.equations)).not.toContain("Growth");
  });

  it("refuses to go below 3 axes", () => {
    const three = { equations: { A: "50", B: "50", C: "50" } };
    expect(removeAxis(three, "A")).toEqual(three);
  });

  it("disableAxis parks the formula without deleting it", () => {
    const next = disableAxis(DEFAULT_TEMPLATE, "Growth");
    expect(next.equations.Growth).toBeUndefined();
    expect(next.disabledEquations?.Growth).toBe(DEFAULT_TEMPLATE.equations.Growth);
    expect(enableAxis(next, "Growth").equations.Growth).toBe(DEFAULT_TEMPLATE.equations.Growth);
  });

  it("uniqueAxisName increments when the base is taken", () => {
    expect(uniqueAxisName(["New Axis"])).toBe("New Axis 2");
  });
});
