import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ThemeContext } from "../../../ThemeContext";
import AdvancedSettingsPanel, { DEFAULT_TEMPLATE } from "../AdvancedSettingsPanel";

vi.mock("../FormulaBuilder", () => ({
  __esModule: true,
  evaluateFormula: () => ({ error: null, preview: 50 }),
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="formula" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const renderPanel = (onApply = vi.fn()) =>
  render(
    <ThemeContext.Provider value={{ theme: "light", toggleTheme: () => {} }}>
      <AdvancedSettingsPanel initialTemplate={DEFAULT_TEMPLATE} onApply={onApply} onClose={vi.fn()} />
    </ThemeContext.Provider>,
  );

describe("AdvancedSettingsPanel", () => {
  it("adds an axis and reflects it in the panel (R4)", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /add axis/i }));
    expect(screen.getByDisplayValue("New Axis")).toBeInTheDocument();
  });

  it("refuses to remove an axis when only 3 remain", () => {
    const threeAxes = {
      ...DEFAULT_TEMPLATE,
      equations: { Valuation: "50", Growth: "50", Stability: "50" },
    };
    render(
      <ThemeContext.Provider value={{ theme: "light", toggleTheme: () => {} }}>
        <AdvancedSettingsPanel initialTemplate={threeAxes} onApply={vi.fn()} onClose={vi.fn()} />
      </ThemeContext.Provider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);
    expect(screen.getByDisplayValue("Valuation")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Growth")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Stability")).toBeInTheDocument();
  });

  it("reset to default restores every original axis", () => {
    const slim = {
      ...DEFAULT_TEMPLATE,
      equations: { Valuation: "50", Growth: "50", Stability: "50" },
    };
    render(
      <ThemeContext.Provider value={{ theme: "light", toggleTheme: () => {} }}>
        <AdvancedSettingsPanel initialTemplate={slim} onApply={vi.fn()} onClose={vi.fn()} />
      </ThemeContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /reset to default/i }));
    for (const name of Object.keys(DEFAULT_TEMPLATE.equations)) {
      expect(screen.getByDisplayValue(name)).toBeInTheDocument();
    }
  });

  it("does not auto-apply a template without the user clicking Apply (P7)", () => {
    const onApply = vi.fn();
    renderPanel(onApply);
    fireEvent.click(screen.getByRole("button", { name: /add axis/i }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /apply template/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].equations["New Axis"]).toBe("50");
  });

  it("turning an axis off keeps its formula after Apply", () => {
    const onApply = vi.fn();
    renderPanel(onApply);
    fireEvent.click(screen.getByRole("checkbox", { name: /disable growth axis/i }));
    fireEvent.click(screen.getByRole("button", { name: /apply template/i }));
    const applied = onApply.mock.calls[0][0] as typeof DEFAULT_TEMPLATE;
    expect(applied.equations.Growth).toBeUndefined();
    expect(applied.disabledEquations?.Growth).toBe(DEFAULT_TEMPLATE.equations.Growth);
  });
});
