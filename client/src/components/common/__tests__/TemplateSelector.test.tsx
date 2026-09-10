import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisTemplateDTO } from "../../../types";
import TemplateSelector from "../TemplateSelector";

const starter: AnalysisTemplateDTO = {
  id: 1,
  name: "Stability First",
  description: "For capital preservation.",
  config: {
    radar: { name: "Stability First", normalization_method: "min-max", scope: "global", equations: { A: "1" } },
    visible_columns: ["name"],
  },
  is_default: true,
  is_owner: false,
  profile_risk_tag: "Conservative",
};

const mine: AnalysisTemplateDTO = {
  ...starter,
  id: 9,
  name: "My Screen",
  is_default: false,
  is_owner: true,
  profile_risk_tag: null,
};

describe("TemplateSelector", () => {
  it("marks the profile-matched starter", () => {
    render(
      <TemplateSelector
        library={{ defaults: [starter], mine: [] }}
        selectedId={1}
        profileRiskTag="Conservative"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("option", { name: /Stability First · matches you/ })).toBeInTheDocument();
  });

  it("loads a setup into the editor without applying it", () => {
    const onSelect = vi.fn();
    render(
      <TemplateSelector
        library={{ defaults: [starter], mine: [mine] }}
        selectedId={1}
        profileRiskTag="Conservative"
        onSelect={onSelect}
      />,
    );
    fireEvent.change(screen.getByLabelText(/load a setup/i), { target: { value: "9" } });
    expect(onSelect).toHaveBeenCalledWith(mine);
  });

  it("lets the user delete an owned setup", () => {
    const onDelete = vi.fn();
    render(
      <TemplateSelector
        library={{ defaults: [starter], mine: [mine] }}
        selectedId={9}
        profileRiskTag="Conservative"
        onSelect={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(9);
  });
});
