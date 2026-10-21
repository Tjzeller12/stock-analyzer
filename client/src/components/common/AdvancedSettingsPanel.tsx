import React, { useMemo, useState } from 'react';
import { AVAILABLE_VARIABLES, VARIABLE_PREFIXES } from '../../constants/radarMetrics';
import { AnalysisTemplateDTO, TemplateLibrary } from '../../types';
import {
  activeAxes,
  addAxis,
  disableAxis,
  disabledAxes,
  enableAxis,
  MAX_RADAR_AXES,
  MIN_RADAR_AXES,
  removeAxis,
  renameAxis,
  setAxisEquation,
  uniqueAxisName,
} from '../../utils/radarTemplate';
import FormulaBuilder, { evaluateFormula } from './FormulaBuilder';
import TemplateSelector from './TemplateSelector';

export interface RadarTemplate {
  name: string;
  scope: 'global' | 'sector' | 'industry';
  equations: Record<string, string>;
  /** Parked formulas: not scored until turned back on. */
  disabledEquations?: Record<string, string>;
}

export const DEFAULT_TEMPLATE: RadarTemplate = {
  name: "Custom scoring",
  scope: "global",
  equations: {
    "Valuation": "0.40 * (1 - forward_pe) + 0.35 * (1 - peg_ratio) + 0.25 * (1 - price_to_sales)",
    "Growth": "0.55 * rev_growth_qoq + 0.45 * eps_growth_qoq",
    "Stability": "0.40 * (1 - debt_to_equity) + 0.30 * (1 - beta) + 0.30 * dividend_yield",
    "Efficiency": "0.40 * roe + 0.30 * operating_margin + 0.30 * roa",
    "Sentiment": "0.60 * ai_moat_score + 0.40 * ai_news_score"
  }
};

interface AdvancedSettingsPanelProps {
  initialTemplate?: RadarTemplate;
  visibleColumns?: string[];
  library?: TemplateLibrary;
  activeId?: number | null;
  profileRiskTag?: string | null;
  onApply: (template: RadarTemplate, columns: string[]) => void;
  onClose: () => void;
  onSaveSetup?: (name: string, description: string, radar: RadarTemplate, columns: string[]) => Promise<AnalysisTemplateDTO>;
  onUpdateSetup?: (id: number, radar: RadarTemplate, columns: string[], meta: { name: string; description: string }) => Promise<AnalysisTemplateDTO>;
  onDeleteSetup?: (id: number) => Promise<void>;
  onPersistActive?: (id: number) => void;
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

function cloneRadar(radar: RadarTemplate): RadarTemplate {
  return {
    ...radar,
    equations: { ...radar.equations },
    disabledEquations: radar.disabledEquations ? { ...radar.disabledEquations } : {},
  };
}

function scoringChanged(current: RadarTemplate, loaded?: RadarTemplate): boolean {
  if (!loaded) return true;
  return JSON.stringify({
    equations: current.equations,
    scope: current.scope,
    disabledEquations: current.disabledEquations ?? {},
  }) !== JSON.stringify({
    equations: loaded.equations,
    scope: loaded.scope,
    disabledEquations: loaded.disabledEquations ?? {},
  });
}

const EMPTY_LIBRARY: TemplateLibrary = { defaults: [], mine: [] };

const AdvancedSettingsPanel: React.FC<AdvancedSettingsPanelProps> = ({
  initialTemplate,
  visibleColumns = [],
  library = EMPTY_LIBRARY,
  activeId = null,
  profileRiskTag = null,
  onApply,
  onClose,
  onSaveSetup,
  onUpdateSetup,
  onDeleteSetup,
  onPersistActive,
}) => {
  const [template, setTemplate] = useState<RadarTemplate>(initialTemplate || DEFAULT_TEMPLATE);
  const [pendingColumns, setPendingColumns] = useState<string[]>(visibleColumns);
  const [selectedId, setSelectedId] = useState<number | null>(activeId);
  const [setupName, setSetupName] = useState(() => {
    const current = [...library.defaults, ...library.mine].find((t) => t.id === activeId);
    return current?.name ?? initialTemplate?.name ?? "";
  });
  const [setupDescription, setSetupDescription] = useState(() => {
    const current = [...library.defaults, ...library.mine].find((t) => t.id === activeId);
    return current?.description ?? "";
  });
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const [showVariablesGuide, setShowVariablesGuide] = useState(false);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const axes = activeAxes(template);
  const invalidCount = useMemo(
    () => axes.filter((name) => evaluateFormula(template.equations[name] ?? "").error).length,
    [axes, template.equations],
  );

  const allSetups = [...library.defaults, ...library.mine];
  const selectedSetup = allSetups.find((t) => t.id === selectedId);
  const columnsForSave = pendingColumns.length > 0 ? pendingColumns : visibleColumns;

  const loadSetup = (t: AnalysisTemplateDTO) => {
    const radar = t.config?.radar;
    if (!radar?.equations) return;
    setTemplate(cloneRadar(radar as RadarTemplate));
    setPendingColumns(t.config.visible_columns?.length ? [...t.config.visible_columns] : visibleColumns);
    setSelectedId(t.id);
    setSetupName(t.name);
    setSetupDescription(t.description ?? "");
    setDraftNames({});
    setActionError(null);
  };

  const persistEditor = async (asNew = false, applyUnmodifiedDefault = false): Promise<number | null> => {
    const name = setupName.trim();
    const description = setupDescription.trim();
    const loadedRadar = selectedSetup?.config.radar as RadarTemplate | undefined;
    const editedDefault = Boolean(selectedSetup?.is_default && scoringChanged(template, loadedRadar));
    const canUpdate = Boolean(selectedSetup && !selectedSetup.is_default && onUpdateSetup && !asNew);

    if (applyUnmodifiedDefault && selectedSetup?.is_default && !editedDefault) {
      return selectedSetup.id;
    }
    if (!name) {
      setActionError("Give this setup a name before saving.");
      return null;
    }
    const radarToSave = { ...template, name };
    if (canUpdate && selectedSetup && onUpdateSetup) {
      await onUpdateSetup(selectedSetup.id, radarToSave, columnsForSave, { name, description });
      return selectedSetup.id;
    }
    if (!onSaveSetup) return null;
    const created = await onSaveSetup(name, description, radarToSave, columnsForSave);
    setSelectedId(created.id);
    return created.id;
  };

  const handleSave = (asNew = false) => {
    if (invalidCount > 0 || busy) return;
    if (!setupName.trim()) {
      setActionError("Give this setup a name before saving.");
      return;
    }
    setBusy(true);
    setActionError(null);
    void persistEditor(asNew)
      .catch(() => setActionError("Could not save scoring setup"))
      .finally(() => setBusy(false));
  };

  const handleApply = () => {
    if (invalidCount > 0 || busy) return;
    if (!onSaveSetup && !onUpdateSetup) {
      onApply(template, columnsForSave);
      onClose();
      return;
    }
    setBusy(true);
    setActionError(null);
    void (async () => {
      const id = await persistEditor(false, true);
      if (id == null) return;
      onPersistActive?.(id);
      onApply(template, columnsForSave);
      onClose();
    })()
      .catch(() => setActionError("Could not apply scoring setup"))
      .finally(() => setBusy(false));
  };

  const atMinAxes = axes.length <= MIN_RADAR_AXES;
  const atMaxAxes = axes.length >= MAX_RADAR_AXES;

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
      <div className="relative mb-4 w-full border-b border-border-main/20 pb-3">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-0 right-0 text-text-main/50 hover:text-red-500 transition-colors text-sm"
        >
          ✕ Close
        </button>
        <div className="w-full text-center px-12">
          <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-[#057a37] text-transparent bg-clip-text">
            Radar scoring
          </h2>
          <p className="text-[11px] text-text-main/60 mt-1 mx-auto max-w-xl leading-snug">
            Each axis is a formula. Those scores draw the spider chart and drive Compare.
            Load a default to fill the formulas, edit them, then Apply to use this scoring on your tables.
          </p>
          <p className="text-[11px] text-text-main/50 mt-1">
            Active axes: {axes.length}
            {atMinAxes ? ` (minimum ${MIN_RADAR_AXES})` : ""}
            {atMaxAxes ? ` (maximum ${MAX_RADAR_AXES})` : ""}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <TemplateSelector
          library={library}
          selectedId={selectedId}
          profileRiskTag={profileRiskTag}
          onSelect={loadSetup}
          onDelete={onDeleteSetup}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div>
            <label htmlFor="setup-name" className="text-xs font-semibold text-text-main block mb-1">Name</label>
            <input
              id="setup-name"
              className="w-full box-border p-2 text-sm border border-border-main/20 rounded-md bg-input-bg text-text-main"
              value={setupName}
              maxLength={100}
              onChange={(e) => setSetupName(e.target.value)}
              placeholder="e.g. Dividend screen"
            />
          </div>
          <div>
            <label htmlFor="setup-description" className="text-xs font-semibold text-text-main block mb-1">Description</label>
            <textarea
              id="setup-description"
              className="w-full box-border p-2 text-sm border border-border-main/20 rounded-md bg-input-bg text-text-main min-h-[42px] resize-y"
              value={setupDescription}
              maxLength={255}
              rows={2}
              onChange={(e) => setSetupDescription(e.target.value)}
              placeholder="What this scoring is for"
            />
          </div>
        </div>
        {selectedSetup && !selectedSetup.is_default && (
          <p className="text-[11px] text-text-main/50 mt-1.5">
            Edit the name, description, or formulas, then Save to update this setup. Save as new keeps the original.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4">
        <h3 className="text-xs font-semibold text-text-main">Compare against</h3>
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
        <p className="text-[10px] text-text-main/50 leading-tight">
          Peer group used when scoring a single stock against the market.
        </p>
      </div>

      <div className="mb-4">
        <button
            type="button"
            onClick={() => setShowScoringGuide(!showScoringGuide)}
            className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
        >
            <span>{showScoringGuide ? '▼' : '▶'}</span>
            How scoring works
        </button>
        {showScoringGuide && (
            <div className="mt-2 p-3 bg-list-bg rounded-lg border border-border-main/15">
                <p className="text-[11px] text-text-main/70 leading-snug">
                Every metric is scored as a <span className="text-text-main font-medium">percentile</span>:
                {" "}0 is the lowest in the group, 1 is the highest, and a metric a company
                {" "}has not reported counts as average. Write each axis as a weighted
                {" "}average that lands between 0 and 1 &mdash; weights that add up to 1 do
                {" "}this automatically. Use <span className="font-mono text-primary">1 - metric</span>
                {" "}when a lower number is better, like a P/E ratio.
                </p>
            </div>
        )}
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
                    <h4 className="text-text-main font-semibold mb-1.5 text-xs">Advanced: other scales</h4>
                    <p className="leading-snug mb-2">
                    A plain name like <span className="font-mono text-primary">roe</span> is its percentile.
                    {" "}Rank is usually what you want, but it flattens extremes: the fastest
                    {" "}grower and the runner-up both sit near 1 even if one grew twice as fast.
                    {" "}To keep that distance, prefix a metric instead.
                    </p>
                    <div className="flex flex-col gap-1">
                    {VARIABLE_PREFIXES.map(({ prefix, label }) => (
                        <div key={prefix} className="flex items-baseline gap-2">
                        <span className="font-mono text-primary bg-primary/10 px-1 rounded shrink-0">{prefix}</span>
                        <span className="leading-snug">{label}</span>
                        </div>
                    ))}
                    </div>
                    <p className="leading-snug mt-2">
                    A <span className="font-mono text-primary">z_</span> value is not between 0 and 1,
                    {" "}so re-centre it yourself:
                    {" "}<span className="font-mono text-primary">(z_rev_growth_qoq + 3) / 6</span>.
                    </p>
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
        <h3 className="text-xs font-semibold text-text-main">Axis formulas</h3>
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
            disabled={atMaxAxes}
            title={atMaxAxes ? `Maximum ${MAX_RADAR_AXES} axes` : undefined}
            className="text-[11px] font-semibold text-primary hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
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
                    disabled={(enabled && atMinAxes) || (!enabled && atMaxAxes)}
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

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border-main/20 pt-3">
        {invalidCount > 0 && (
          <p className="mr-auto text-xs text-red-500 self-center">{invalidCount} formula{invalidCount > 1 ? "s" : ""} need fixing</p>
        )}
        {actionError && (
          <p className="mr-auto text-xs text-red-500 self-center">{actionError}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-md text-xs font-semibold bg-list-bg text-text-main hover:bg-border-main/20 transition-colors border border-border-main/15"
        >
          Cancel
        </button>
        {onSaveSetup && (
          <>
            {selectedSetup && !selectedSetup.is_default && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={invalidCount > 0 || busy || !setupName.trim()}
                title="Keep the original and save a new copy"
                className="px-4 py-1.5 rounded-md text-xs font-semibold text-text-main/70 hover:text-text-main"
              >
                Save as new
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={invalidCount > 0 || busy || !setupName.trim()}
              title="Keep these formulas without changing the tables yet"
              className="px-4 py-1.5 rounded-md text-xs font-semibold border border-primary/40 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={handleApply}
          disabled={invalidCount > 0 || busy}
          title="Use this scoring on your tables and save it"
          className="px-4 py-1.5 rounded-md text-xs font-semibold bg-gradient-to-r from-primary to-[#057a37] text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
        >
          Apply
        </button>
      </div>
    </div>
  );
};

export default AdvancedSettingsPanel;
