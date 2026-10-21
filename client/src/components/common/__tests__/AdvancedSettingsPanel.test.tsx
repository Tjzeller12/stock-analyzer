import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].equations["New Axis"]).toBe("50");
  });

  it("stops adding axes at 8", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /add axis/i }));
    fireEvent.click(screen.getByRole("button", { name: /add axis/i }));
    expect(screen.getByRole("button", { name: /add axis/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /add axis/i }));
    expect(screen.queryByDisplayValue("New Axis 3")).not.toBeInTheDocument();
  });

  it("turning an axis off keeps its formula after Apply", () => {
    const onApply = vi.fn();
    renderPanel(onApply);
    fireEvent.click(screen.getByRole("checkbox", { name: /disable growth axis/i }));
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    const applied = onApply.mock.calls[0][0] as typeof DEFAULT_TEMPLATE;
    expect(applied.equations.Growth).toBeUndefined();
    expect(applied.disabledEquations?.Growth).toBe(DEFAULT_TEMPLATE.equations.Growth);
  });

  it("loads a starter into the editor without applying until Apply", () => {
    const onApply = vi.fn();
    const starter = {
      id: 1,
      name: "Stability First",
      description: "For capital preservation.",
      is_default: true,
      is_owner: false,
      profile_risk_tag: "Conservative",
      config: {
        radar: {
          name: "Stability First",
          scope: "global" as const,
          equations: { Valuation: "1 - pe_ratio", Stability: "1 - beta", Efficiency: "roe" },
        },
        visible_columns: ["name", "price"],
      },
    };
    render(
      <ThemeContext.Provider value={{ theme: "light", toggleTheme: () => {} }}>
        <AdvancedSettingsPanel
          initialTemplate={DEFAULT_TEMPLATE}
          library={{ defaults: [starter], mine: [] }}
          activeId={null}
          onApply={onApply}
          onClose={vi.fn()}
        />
      </ThemeContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText(/load a setup/i), { target: { value: "1" } });
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Valuation")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Insider Confidence")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].equations.Valuation).toBe("1 - pe_ratio");
    expect(onApply.mock.calls[0][1]).toEqual(["name", "price"]);
  });

  it("fills name and description from the loaded setup so they can be edited", () => {
    const owned = {
      id: 10,
      name: "My Screen",
      description: "Tweaked growth mix",
      is_default: false,
      is_owner: true,
      config: {
        radar: {
          name: "My Screen",
          scope: "global" as const,
          equations: { Valuation: "50", Growth: "50", Stability: "50" },
        },
        visible_columns: ["name"],
      },
    };
    render(
      <ThemeContext.Provider value={{ theme: "light", toggleTheme: () => {} }}>
        <AdvancedSettingsPanel
          initialTemplate={owned.config.radar}
          library={{ defaults: [], mine: [owned] }}
          activeId={10}
          onApply={vi.fn()}
          onClose={vi.fn()}
          onSaveSetup={vi.fn()}
          onUpdateSetup={vi.fn()}
        />
      </ThemeContext.Provider>,
    );
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("My Screen");
    expect(screen.getByLabelText(/^description$/i)).toHaveValue("Tweaked growth mix");
  });

  it("saves name and description onto an owned setup", async () => {
    const owned = {
      id: 10,
      name: "My Screen",
      description: "old",
      is_default: false,
      is_owner: true,
      config: {
        radar: {
          name: "My Screen",
          scope: "global" as const,
          equations: { Valuation: "50", Growth: "50", Stability: "50" },
        },
        visible_columns: ["name"],
      },
    };
    const onUpdateSetup = vi.fn().mockResolvedValue({ ...owned, name: "Dividend screen" });
    const onSaveSetup = vi.fn();
    render(
      <ThemeContext.Provider value={{ theme: "light", toggleTheme: () => {} }}>
        <AdvancedSettingsPanel
          initialTemplate={owned.config.radar}
          library={{ defaults: [], mine: [owned] }}
          activeId={10}
          onApply={vi.fn()}
          onClose={vi.fn()}
          onSaveSetup={onSaveSetup}
          onUpdateSetup={onUpdateSetup}
        />
      </ThemeContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Dividend screen" } });
    fireEvent.change(screen.getByLabelText(/^description$/i), { target: { value: "Income focus" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(onUpdateSetup).toHaveBeenCalledTimes(1));
    expect(onUpdateSetup.mock.calls[0][0]).toBe(10);
    expect(onUpdateSetup.mock.calls[0][3]).toEqual({
      name: "Dividend screen",
      description: "Income focus",
    });
    expect(onSaveSetup).not.toHaveBeenCalled();
  });

  it("creates a named copy when saving a starter", async () => {
    const starter = {
      id: 1,
      name: "Balanced Core",
      description: "Even mix",
      is_default: true,
      is_owner: false,
      profile_risk_tag: "Balanced",
      config: {
        radar: {
          name: "Balanced Core",
          scope: "global" as const,
          equations: { Valuation: "50", Growth: "50", Stability: "50" },
        },
        visible_columns: ["name"],
      },
    };
    const onSaveSetup = vi.fn().mockResolvedValue({ ...starter, id: 99, is_default: false, is_owner: true, name: "My balanced" });
    const onUpdateSetup = vi.fn();
    render(
      <ThemeContext.Provider value={{ theme: "light", toggleTheme: () => {} }}>
        <AdvancedSettingsPanel
          initialTemplate={starter.config.radar}
          library={{ defaults: [starter], mine: [] }}
          activeId={1}
          onApply={vi.fn()}
          onClose={vi.fn()}
          onSaveSetup={onSaveSetup}
          onUpdateSetup={onUpdateSetup}
        />
      </ThemeContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "My balanced" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(onSaveSetup).toHaveBeenCalledTimes(1));
    expect(onSaveSetup.mock.calls[0][0]).toBe("My balanced");
    expect(onUpdateSetup).not.toHaveBeenCalled();
  });
});
