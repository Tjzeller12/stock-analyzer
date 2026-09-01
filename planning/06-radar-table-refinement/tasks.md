# Tasks — Radar & Table Refinement

> (Rn) requirement · (Pn) property. Mostly frontend; backend score engine unchanged. **Next feature.**

- [x] 1. Column registry
  - [x] 1.1 Create `client/src/constants/tableColumns.ts` — `ColumnSpec`, `COLUMN_REGISTRY` (migrate current metric columns 1:1), `DEFAULT_VISIBLE_COLUMNS` (R1, P10)
  - [x] 1.2 Create formatter helpers per `format` type (reuse `utils/formatters`) (R1)

- [x] 2. Table preferences
  - [x] 2.1 Create `client/src/hooks/useTablePreferences.tsx` — localStorage persist/restore, `toggleColumn` guard (last data column), reset (R1, P4, P6)
  - [x] 2.2 Build metric `columnDefs` from registry × visible prefs on every MainPage stock table, keeping structural columns always (R1, R7, P5)
  - [x] 2.3 Create `components/common/ColumnCustomizer.tsx` — grouped checklist popover; one instance applies to all tables (R1, R7)

- [x] 3. Radar axis customization
  - [x] 3.1 Create `client/src/utils/radarTemplate.ts` — `addAxis` (neutral default), `removeAxis` (keep ≥1), `activeAxes` (R2, P4, P8)
  - [x] 3.2 Restyle `AdvancedSettingsPanel` — per-axis enable/rename/remove + "Add axis" + inline validation (R4)
  - [x] 3.3 Replace hardcoded dark colors with theme tokens (`bg-form-bg`, `text-text-main`, `border-border-main`); verify light mode contrast on chips, help, and buttons (R4, P13)
  - [x] 3.4 Ensure removing/adding axes flows through existing `/radar/*` calls unchanged (R2, P2)

- [x] 4. Health color fix
  - [x] 4.1 Create `client/src/utils/healthColor.ts` — average-based thresholds (R3, P3)
  - [x] 4.2 Replace hardcoded 300/400/600 logic in table radar cells and `StockPage` radar (R3, P3)

- [x] 5. MainPage density + progressive compare
  - [x] 5.1 `#compare-results` leads with Radar + Distribution, then Comparison Analysis; mount the region only after Compare (or restored result) (R5, R6, P11, P12)
  - [x] 5.2 On Compare click, `scrollIntoView` the chart row immediately (R6, P12)
  - [x] 5.3 Radar paints from `compareRadarScores` as soon as `/radar/compare` returns; do not gate it on analysis `compareLoading` / `compareResult` (R6, P14)
  - [x] 5.4 Distribution paints from its own data (doughnut today; leave a slot that 07 can fill without waiting on markdown) (R6, P14)
  - [x] 5.5 Confirm Watchlist/Portfolio (or `StockTable` until 10 merges) still share one `visibleColumns` list (R7)

- [x] 6. Tests
  - [x] 6.1 Frontend `useTablePreferences.test.tsx` — persist/restore (P6), can't remove last column (P4), default set (P10)
  - [x] 6.2 Frontend `healthColor.test.ts` — same color for 3-axis vs 6-axis equivalent averages (P3)
  - [x] 6.3 Frontend `radarTemplate.test.ts` — add neutral axis no NaN (P8), remove keeps others (P2), can't remove last (P4)
  - [x] 6.4 Frontend `AdvancedSettingsPanel.test.tsx` — add/remove axis reflected in radar; suggestion opt-in only (P7)
  - [x] 6.5 Frontend MainPage — empty compare region absent until Compare; radar visible before analysis finishes; scroll targets `#compare-results` (P11, P12, P14)
