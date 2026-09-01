# Design — Radar & Table Refinement

> **Status:** Implemented on `radar-table-refinement` · **Owner:** Thomas · **Last updated:** 2026-08-31
>
> Scope: make the MainPage analysis surface customizable *and* less exhausting to use:
> 1. **Customizable table columns** — ship the most-used statistics by default, let the user add/remove columns. After feature 10, one picker drives **both** Watchlist and My Portfolio via the shared metric-column builders.
> 2. **Removable radar axes** — let the user drop axes they don't care about (e.g. keep only 3 of the 6), reflected in both the table mini-radar and the detail radar.
> 3. **Advanced panel restyle + light mode** — clearer equation builder (grouped axes, inline validation, add/remove-axis) using theme tokens so it is readable in light mode (today it is hardcoded dark: `bg-[#1a1c23]`, `bg-black/40`, `text-gray-300`).
> 4. **MainPage density + progressive compare** — no empty compare chrome; Compare jumps to results; **deterministic charts (radar now, allocation in 07) render first** so the user has something to look at while the LLM analysis streams in.
>
> **Reuses / touches:** MainPage stock table(s) (`StockTable` on `main`; Watchlist + Portfolio after 10 merges), `AdvancedSettingsPanel` + `FormulaBuilder` (`RadarTemplate`), `RadarGraph`, `score_engine.py` (already evaluates each axis equation independently over arbitrary keys), and the per-stock radar "traffic light" health color (currently hardcodes a 6-axis / 600-max assumption).

---

## 1. Architecture

### 1.1 Where this fits

The backend already supports arbitrary radar axes: `evaluate_equations` iterates `template.equations.items()` and returns one score per key, so **removing or adding an axis is purely a matter of which keys exist in the template** — no engine change. The frontend, however, hardcodes both the column list (a ~25-entry `columnDefs` array in `StockTable`) and the health-color thresholds (`totalScore < 300` / `<= 400`, assuming 6 axes summing to 600). This feature makes both **config-driven and user-customizable**.

```
┌──────────────────────── CLIENT (React) ────────────────────────┐
│  StockTable                                                     │
│    columnDefs = buildColumnDefs(COLUMN_REGISTRY, visibleColIds) │
│    <ColumnCustomizer/>  ── grouped checklist, add/remove cols   │
│    radar cell color = healthColor(scores, activeAxes)  (scaled) │
│                                                                 │
│  AdvancedSettingsPanel (restyled)                               │
│    ├─ axis manager: toggle / add / remove axes (template keys)  │
│    ├─ grouped FormulaBuilders w/ inline validation              │
│    └─ live "active axes: N" + reset-to-default                  │
│                                                                 │
│  prefs persisted: useTablePreferences()  → localStorage         │
│    { visibleColumns: string[], columnOrder: string[] }          │
│  template (incl. active axes) persisted via feature 08          │
└─────────────────────────────────────────────────────────────-─┘
            (no backend change required for the core feature)
```

### 1.2 Key architectural decisions

- **Columns become a registry, not a literal array.** A single `COLUMN_REGISTRY` declares every available column (id, header, accessor field, formatter, group). `StockTable` renders `columnDefs` by mapping the user's `visibleColumns` over the registry. Pinned structural columns (radar, symbol, select, remove) are always present and not user-removable. See **P1**, **P5**.

- **Radar axes are just template keys; removal is non-destructive to other axes.** Because each equation is evaluated independently, dropping an axis changes *which* scores are returned but never recomputes the remaining axes' values. The score engine is untouched. See **P2**.

- **Health color must scale with the active axis count.** The "traffic light" is recomputed from the **average** axis score (0–100), not a fixed 600 sum, so a 3-axis radar and a 6-axis radar are colored on the same scale. This is a bug fix that becomes mandatory once axis count is variable. See **P3**.

- **Table prefs live in `localStorage`; axis selection lives in the `RadarTemplate`.** Column visibility/order is a lightweight UI pref (client-only, instant). The active axis set is part of the template (so it's saved/shared by the community-templates feature). Feature 08 later auto-applies a profile-matched default when the user has no owned templates; until then, 06 uses `DEFAULT_VISIBLE_COLUMNS`. A user who has already customized columns is never silently reset. See **P6**, **P7**.

- **One column picker, every stock table.** Metric columns come from a shared registry. Watchlist-only (remove) and portfolio-only (qty / cost / PnL) columns stay structural and are not in the picker. Toggling "P/E" hides it in both tables. See **P1**, **P5**.

- **Empty compare chrome does not occupy the page.** Compare Radar, Portfolio Distribution, and Comparison Analysis mount only after the user clicks Compare (or when a prior result is restored). News stays. See **P11**.

- **Deterministic charts first; LLM analysis second.** Compare already fetches `/radar/compare` before starting the analysis stream. The results region leads with Radar (and Distribution). Those cards fill as soon as their data exists and must not wait on `compareResult`. The analysis card may keep streaming below. Feature 07 swaps the doughnut off Claude onto the allocation engine so it can fill on the same fast path as radar. See **P12**, **P14**.

- **Compare is a jump, not a scavenger hunt.** Clicking Compare starts radar + analysis and `scrollIntoView`s `#compare-results` (the chart row), so the user lands on the radar, not the tables. See **P12**.

- **Advanced panel uses theme tokens, not hardcoded dark surfaces.** Light mode must keep contrast on labels, chips, formula help, and buttons. See **P13**.

- **Guardrails: never zero columns, never zero axes.** The customizer enforces at least one data column and the axis manager enforces at least one axis, so the grid and radar can't be rendered empty. See **P4**.

### 1.3 Data flow

1. `useTablePreferences` hydrates `visibleColumns`/`columnOrder` from `localStorage` (or registry defaults).
2. `StockTable` builds `columnDefs` from the registry filtered/ordered by prefs; `ColumnCustomizer` toggles update prefs and persist.
3. The radar cell renderer computes color via `healthColor(scores, activeAxes)`.
4. In `AdvancedSettingsPanel`, adding/removing an axis edits `template.equations`; "Apply" pushes the new template (with its axis set) through the existing `/radar/*` calls, which return scores for exactly the active axes.
5. Compare click → `#compare-results` scrolls into view → `/radar/compare` paints the radar as soon as scores return → analysis stream fills the markdown card independently. Doughnut stays gated on its own data (Claude today, allocation engine in 07).

---

## 2. Components and Interfaces

### 2.1 Column registry + types — `client/src/constants/tableColumns.ts`

```typescript
export type ColumnGroup =
  | "Identity" | "Valuation" | "Profitability" | "Growth"
  | "Cash Flow" | "Balance Sheet" | "Risk" | "AI";

export interface ColumnSpec {
  id: string;                         // stable, e.g. "pe_ratio"
  header: string;                     // "P/E"
  field: keyof Stock;                 // accessor
  group: ColumnGroup;
  format: "currency" | "bigNumber" | "percent" | "ratio" | "integer" | "text";
  removable: boolean;                 // structural cols (symbol) are false
  defaultVisible: boolean;            // ships in the default common-stats set
  width?: number;
}

export const COLUMN_REGISTRY: ColumnSpec[] = [
  { id: "symbol",        header: "Symbol",     field: "symbol",        group: "Identity",      format: "text",      removable: false, defaultVisible: true,  width: 100 },
  { id: "price",         header: "Price",      field: "price",         group: "Identity",      format: "currency",  removable: true,  defaultVisible: true },
  { id: "market_cap",    header: "Market Cap", field: "market_cap",    group: "Valuation",     format: "bigNumber", removable: true,  defaultVisible: true },
  { id: "pe_ratio",      header: "P/E",        field: "pe_ratio",      group: "Valuation",     format: "ratio",     removable: true,  defaultVisible: true },
  // … the full set migrated 1:1 from the current hardcoded columnDefs …
  { id: "ai_moat_score", header: "AI Moat",    field: "ai_moat_score", group: "AI",            format: "integer",   removable: true,  defaultVisible: false },
];

export const DEFAULT_VISIBLE_COLUMNS = COLUMN_REGISTRY.filter(c => c.defaultVisible).map(c => c.id);
```

### 2.2 `useTablePreferences` hook — `client/src/hooks/useTablePreferences.tsx`

```typescript
export interface TablePreferences {
  visibleColumns: string[];   // column ids, in display order
}

export interface UseTablePreferences {
  visibleColumns: string[];
  isVisible: (id: string) => boolean;
  toggleColumn: (id: string) => void;     // no-op if removing the last data column (P4)
  setOrder: (ids: string[]) => void;
  resetToDefault: () => void;
}

export function useTablePreferences(): UseTablePreferences;
// Persists to localStorage["alphabot.tablePrefs.v1"]; falls back to DEFAULT_VISIBLE_COLUMNS.
```

### 2.3 Components

```typescript
// client/src/components/common/ColumnCustomizer.tsx
interface ColumnCustomizerProps {
  registry: ColumnSpec[];
  visibleColumns: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
}
// Grouped checklist (by ColumnGroup) in a popover; structural columns shown disabled.

// client/src/components/common/AdvancedSettingsPanel.tsx  (restyled, extended)
// New: per-axis row with [enabled toggle] [rename] [remove], an "Add axis" control,
// and inline FormulaBuilder validation state. The template gains/loses keys here.
```

### 2.4 Radar axis helpers + health color — `client/src/utils/`

```typescript
// healthColor scales with the number of active axes (avg 0–100), replacing the
// hardcoded 300/400/600 thresholds in StockTable + StockPage.
export function healthColor(
  scores: Record<string, number>,
  activeAxes: string[]
): { borderColor: string; bgColor: string } {
  const used = activeAxes.length ? activeAxes : Object.keys(scores);
  if (used.length === 0) return NEUTRAL;
  const avg = used.reduce((a, k) => a + (scores[k] ?? 0), 0) / used.length;
  if (avg < 50) return RED;
  if (avg <= 66) return YELLOW;
  return GREEN;
}

// RadarTemplate axis operations (pure)
export function addAxis(t: RadarTemplate, name: string): RadarTemplate;       // default neutral eqn
export function removeAxis(t: RadarTemplate, name: string): RadarTemplate;    // guard: keep >= 1
export function activeAxes(t: RadarTemplate): string[];                       // Object.keys(equations)
```

### 2.5 Backend

**No backend changes required for the core feature.** `score_engine.evaluate_equations` already returns one score per template key, so a template with 3 axes returns 3 scores. (If we later persist table column prefs server-side, that piggybacks on feature 08 / a `ui_preferences` JSON — explicitly out of scope here.)

---

## 3. Data Models

### 3.1 No new SQL tables

- **Column prefs:** `localStorage["alphabot.tablePrefs.v1"] = { visibleColumns: string[] }`.
- **Active axes:** carried inside the existing `RadarTemplate.equations` (keys = axes). Persistence of templates is feature 08's concern.

### 3.2 `RadarTemplate` semantics (clarified, shape unchanged)

`equations: Record<string, string>` — the **set of keys is the set of active axes**. Removing an axis deletes its key; adding one inserts a key with a safe default equation (e.g. a neutral constant) until the user edits it.

---

## 4. Correctness Properties

### P1 — Hiding a column is a non-destructive view operation
Toggling a column off only removes it from the rendered `columnDefs`; the underlying `Stock` data and all other columns are untouched. Re-enabling the column restores it with its original formatter and no data loss.

### P2 — Removing a radar axis leaves the remaining axes' scores unchanged
Because each axis equation is evaluated independently, dropping axis X does not alter the computed value of any axis Y. Removing an axis is a pure reduction of the result set, never a recomputation of the survivors.

### P3 — Health color is invariant to axis count
The traffic-light color is derived from the **average** active-axis score (0–100), so a portfolio scored on 3 axes and one scored on 6 axes use the same thresholds. Changing how many axes are active never spuriously turns a good stock red (the failure mode of the current fixed 300/400/600 logic).

### P4 — At least one column and one axis always remain
The column customizer refuses to remove the last data column and the axis manager refuses to remove the last axis. The grid always has data columns and the radar always has at least one axis; neither can be rendered empty.

### P5 — Structural columns are always present
The radar, symbol, select, and remove columns are not user-removable and are always rendered (and pinned) regardless of preferences, so core interactions (select for compare, remove, navigate) never disappear.

### P6 — Preferences persist and restore exactly
Column visibility/order and the active axis set survive reloads: column prefs from `localStorage`, axes from the active template. Reopening the app reproduces the user's exact table and radar configuration.

### P7 — Personalization suggestions never overwrite user prefs
A suggested default column set or template is applied only on first run (feature 08: no owned templates) or explicit opt-in, and never silently replaces a configuration the user has already customized (shared invariant with feature 01's P7 / 08's P15).

### P8 — Adding an axis can never produce NaN
A newly added axis starts with a safe default equation that evaluates to a finite, in-range score (clamped 0–100 by the engine). An axis with a not-yet-written formula renders as a neutral value, never `NaN`/blank.

### P9 — Table mini-radar and detail radar share one axis set
The active axis set drives both the in-row mini radar and the full-page detail radar, so the two views always show the same axes for the same template. They can't drift out of sync.

### P10 — Default column set is deterministic
With no saved prefs, the visible columns are exactly `DEFAULT_VISIBLE_COLUMNS` (the `defaultVisible` registry entries) in registry order — the same "common statistics" set for every fresh user.

### P11 — Empty compare cards do not take layout space
Until the user has started a compare (or restored a prior one), Radar / Distribution / Analysis cards are not rendered. Reloading with no active compare restores the compact layout. News is unaffected.

### P12 — Compare scrolls the user to the charts
Activating Compare brings `#compare-results` into view (smooth scroll, start-aligned) as soon as the click is handled. The region **leads with the deterministic charts**, so the user is looking at radar (and later allocation) while analysis is still loading.

### P13 — Advanced panel is theme-correct in light and dark
The panel and formula help use CSS/theme tokens (`bg-form-bg`, `text-text-main`, `border-border-main`, etc.). Hardcoded dark-only colors (`#1a1c23`, `black/40`, `gray-300`, `hover:text-white`) are not acceptable. Light mode keeps readable contrast on every control.

### P14 — Charts are not blocked on the LLM
Compare Radar renders as soon as `compareRadarScores` exists. It must not sit behind `compareLoading` / `compareResult` from the analysis stream. Portfolio Distribution renders as soon as *its* data exists (doughnut payload today; allocation plan in feature 07) and likewise must not wait on the analysis markdown. The analysis card may show its own loading/streaming state.

---

## 5. Resolved decisions (confirmed)

1. **Columns = registry-driven; defaults = the common-stats subset; structural columns fixed.** One picker applies to every MainPage stock table.
2. **Axes = `RadarTemplate` keys; add/remove via the restyled advanced panel; engine unchanged.**
3. **Health color rescaled to average-based thresholds** (fixes the 6-axis assumption — applies to table radar cells and `StockPage`).
4. **Column prefs in `localStorage`; axis set in the template** (server-side pref persistence deferred to feature 08).
5. **MainPage: hide empty compare cards; Compare auto-scrolls to the chart row; radar (and later doughnut) paint before the LLM analysis.**
6. **Advanced panel restyle includes a light-mode token pass**, not just layout.
