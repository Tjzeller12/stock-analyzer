import React, { useMemo, useState } from 'react';
import { AVAILABLE_VARIABLES } from '../../constants/radarMetrics';
import {
  activeAxes,
  addAxis,
  disableAxis,
  disabledAxes,
  enableAxis,
  MIN_RADAR_AXES,
  removeAxis,
  renameAxis,
  setAxisEquation,
  uniqueAxisName,
} from '../../utils/radarTemplate';
import FormulaBuilder, { evaluateFormula } from './FormulaBuilder';

export interface RadarTemplate {
  name: string;
  normalization_method: 'min-max' | 'z-score';
  scope: 'global' | 'sector' | 'industry';
  equations: Record<string, string>;
  /** Parked formulas: not scored until turned back on. */
  disabledEquations?: Record<string, string>;
}

export const DEFAULT_TEMPLATE: RadarTemplate = {
  name: "Custom Template",
  normalization_method: "min-max",
  scope: "global",
  equations: {
    "Valuation": "(1 - forward_pe) * 0.4 + (1 - ev_to_ebitda) * 0.3 + (1 - price_to_fc) * 0.3",
    "Growth": "0.4 + (eps_growth_qoq * 0.3) + (rev_growth_qoq * 0.3) + (insider_volume / (market_cap + 0.2)) * 0.2",
    "Stability": "(1 - debt_to_equity) * 0.4 + (1 - beta) * 0.4 + dividend_yield * 0.2",
    "Sentiment": "ai_moat_score * 0.6 + ai_news_score * 0.4",
    "Efficiency": "roe * 0.4 + roa * 0.3 + profit_margin * 0.3",
    "Insider Confidence": "0.5 + (insider_volume / (market_cap + 0.2)) * 0.5"
  }
};

interface AdvancedSettingsPanelProps {
  initialTemplate?: RadarTemplate;
  onApply: (template: RadarTemplate) => void;
  onClose: () => void;
}

const chipIdle = "text-text-main/70 hover:text-text-main hover:bg-list-bg";
const chipActive = "bg-primary text-white shadow-md";

const MATH_OPERATORS: { op: string; label: string }[] = [
  { op: "+", label: "Add" },
  { op: "-", label: "Subtract" },
  { op: "*", label: "Multiply" },
  { op: "/", label: "Divide" },
  { op: "**", label: "Exponent" },
  { op: "sqrt()", label: "Sq Root" },
  { op: "log10()", label: "Log 10" },
  { op: "abs()", label: "Abs Val" },
  { op: "( )", label: "Group" },
];

const AdvancedSettingsPanel: React.FC<AdvancedSettingsPanelProps> = ({ initialTemplate, onApply, onClose }) => {
  const [template, setTemplate] = useState<RadarTemplate>(initialTemplate || DEFAULT_TEMPLATE);
  const [showVariablesGuide, setShowVariablesGuide] = useState(false);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});

  const axes = activeAxes(template);
  const invalidCount = useMemo(
    () => axes.filter((name) => evaluateFormula(template.equations[name] ?? "").error).length,
    [axes, template.equations],
  );

  const handleApply = () => {
    if (invalidCount > 0) return;
    onApply(template);
  };

  const atMinAxes = axes.length <= MIN_RADAR_AXES;

  const resetToDefaultAxes = () => {
    setTemplate({
      ...DEFAULT_TEMPLATE,
      equations: { ...DEFAULT_TEMPLATE.equations },
      disabledEquations: {},
    });
    setDraftNames({});
  };

  const toggleAxis = (name: string) => {
    setTemplate((prev) => (
      name in prev.equations ? disableAxis(prev, name) : enableAxis(prev, name)
    ));
  };

  const handleAddAxis = () => {
    const name = uniqueAxisName([...axes, ...disabledAxes(template)]);
    setTemplate((prev) => addAxis(prev, name));
  };

  const handleRename = (from: string) => {
    const next = (draftNames[from] ?? from).trim();
    if (!next || next === from) return;
    setTemplate((prev) => renameAxis(prev, from, next));
    setDraftNames((prev) => {
      const { [from]: _drop, ...rest } = prev;
      return rest;
    });
  };

  const allKnown = [...axes, ...disabledAxes(template)];

  return (
    <div className="bg-form-bg p-4 rounded-xl border border-border-main/20 mt-3 shadow-xl mb-4">
      <div className="flex justify-between items-center mb-4 border-b border-border-main/20 pb-3">
        <div>
          <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-[#057a37] text-transparent bg-clip-text">
            Advanced Engine Settings
          </h2>
          <p className="text-[11px] text-text-main/50 mt-0.5">
            Active axes: {axes.length}
            {atMinAxes ? ` (minimum ${MIN_RADAR_AXES})` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-main/50 hover:text-red-500 transition-colors text-sm"
        >
          ✕ Close
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-list-bg p-3 rounded-lg border border-border-main/15">
            <h3 className="text-xs font-semibold mb-2 text-text-main">Data Normalization Formatting</h3>
            <div className="flex items-center gap-2 bg-form-bg p-1 rounded-md w-fit border border-border-main/10">
            <button
                type="button"
                onClick={() => setTemplate({ ...template, normalization_method: 'min-max' })}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                template.normalization_method === 'min-max' ? chipActive : chipIdle
                }`}
            >
                Min-Max (Bounded 0-1)
            </button>
            <button
                type="button"
                onClick={() => setTemplate({ ...template, normalization_method: 'z-score' })}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                template.normalization_method === 'z-score' ? chipActive : chipIdle
                }`}
            >
                Z-Score (Outliers)
            </button>
            </div>
            <p className="text-[10px] text-text-main/50 mt-1.5 ml-1 leading-tight">
            {template.normalization_method === 'min-max'
                ? "Values are strictly scaled between the lowest and highest stats in the group."
                : "Highlights extreme outliers by measuring standard deviations from the mean."}
            </p>
        </div>

        <div className="bg-list-bg p-3 rounded-lg border border-border-main/15">
            <h3 className="text-xs font-semibold mb-2 text-text-main">Single Stock Comparison Scope</h3>
            <div className="flex items-center gap-1.5 bg-form-bg p-1 rounded-md w-fit border border-border-main/10">
            {(['global', 'sector', 'industry'] as const).map(scope_val => (
                <button
                    type="button"
                    key={scope_val}
                    onClick={() => setTemplate({ ...template, scope: scope_val })}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all capitalize ${
                    template.scope === scope_val ? chipActive : chipIdle
                    }`}
                >
                    {scope_val}
                </button>
            ))}
            </div>
            <p className="text-[10px] text-text-main/50 mt-1.5 ml-1 leading-tight">
               Select which peer group to compare against when viewing a single stock's profile.
            </p>
        </div>
      </div>

       <div className="mb-4">
        <button
            type="button"
            onClick={() => setShowVariablesGuide(!showVariablesGuide)}
            className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
            <span>{showVariablesGuide ? '▼' : '▶'}</span>
            Variables & Operators Guide
        </button>
        {showVariablesGuide && (
            <div className="mt-2 flex flex-col gap-3">
                <div className="p-3 bg-list-bg rounded-lg border border-border-main/15 text-[11px] text-text-main/70">
                    <h4 className="text-text-main font-semibold mb-1.5 text-xs">Available Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                        {AVAILABLE_VARIABLES.map(v => (
                            <div key={v} className="bg-form-bg px-1.5 py-0.5 rounded font-mono select-all truncate border border-border-main/10">{v}</div>
                        ))}
                    </div>
                </div>
                <div className="p-3 bg-list-bg rounded-lg border border-border-main/15 text-[11px] text-text-main/70">
                    <h4 className="text-text-main font-semibold mb-1.5 text-xs">Math Operators</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                        {MATH_OPERATORS.map(({ op, label }) => (
                          <div
                            key={op}
                            title={`${op} — ${label}`}
                            className="bg-form-bg px-1.5 py-0.5 rounded flex items-center gap-1.5 border border-border-main/10"
                          >
                            <span className="font-mono text-primary font-bold bg-primary/10 px-1 rounded">{op}</span>
                            {label}
                          </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-2 border-b border-border-main/10 pb-1.5">
        <h3 className="text-xs font-semibold text-text-main">Radar Grid Algorithms</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetToDefaultAxes}
            className="text-[11px] font-semibold text-text-main/60 hover:text-text-main"
          >
            Reset to default
          </button>
          <button
            type="button"
            onClick={handleAddAxis}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            + Add axis
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {allKnown.map((name) => {
          const enabled = name in template.equations;
          const equation = enabled
            ? template.equations[name]
            : (template.disabledEquations?.[name] ?? "");
          return (
            <div key={name} className={`rounded-lg border border-border-main/15 p-3 bg-list-bg ${enabled ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <label className="flex items-center gap-1.5 text-[11px] text-text-main">
                  <input
                    type="checkbox"
                    className="accent-[#069042]"
                    checked={enabled}
                    disabled={enabled && atMinAxes}
                    onChange={() => toggleAxis(name)}
                    aria-label={`${enabled ? "Disable" : "Enable"} ${name} axis`}
                  />
                  In radar
                </label>
                <input
                  type="text"
                  value={draftNames[name] ?? name}
                  onChange={(e) => setDraftNames((prev) => ({ ...prev, [name]: e.target.value }))}
                  onBlur={() => enabled && handleRename(name)}
                  onKeyDown={(e) => { if (e.key === "Enter" && enabled) handleRename(name); }}
                  disabled={!enabled}
                  className="flex-1 min-w-0 text-xs font-semibold bg-form-bg text-text-main border border-border-main/20 rounded px-2 py-1"
                  aria-label={`Rename ${name} axis`}
                />
                <button
                  type="button"
                  onClick={() => setTemplate((prev) => removeAxis(prev, name))}
                  disabled={enabled && atMinAxes}
                  className="text-[11px] font-semibold text-red-500 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
              <FormulaBuilder
                  label=""
                  value={equation}
                  onChange={(val) => setTemplate((prev) => setAxisEquation(prev, name, val))}
                />
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-border-main/20 pt-3">
        {invalidCount > 0 && (
          <p className="mr-auto text-xs text-red-500 self-center">{invalidCount} formula{invalidCount > 1 ? "s" : ""} need fixing</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-md text-xs font-semibold bg-list-bg text-text-main hover:bg-border-main/20 transition-colors border border-border-main/15"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={invalidCount > 0}
          className="px-4 py-1.5 rounded-md text-xs font-semibold bg-gradient-to-r from-primary to-[#057a37] text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
        >
          Apply Template
        </button>
      </div>
    </div>
  );
};

export default AdvancedSettingsPanel;
