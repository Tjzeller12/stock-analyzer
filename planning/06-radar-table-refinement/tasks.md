# Tasks — Radar & Table Refinement

> (Rn) requirement · (Pn) property. Mostly frontend; backend score engine unchanged.

- [ ] 1. Column registry
  - [ ] 1.1 Create `client/src/constants/tableColumns.ts` — `ColumnSpec`, `COLUMN_REGISTRY` (migrate current `columnDefs` 1:1), `DEFAULT_VISIBLE_COLUMNS` (R1, P10)
  - [ ] 1.2 Create formatter helpers per `format` type (reuse `utils/formatters`) (R1)

- [ ] 2. Table preferences
  - [ ] 2.1 Create `client/src/hooks/useTablePreferences.tsx` — localStorage persist/restore, `toggleColumn` guard (last data column), reset (R1, P4, P6)
  - [ ] 2.2 Refactor `StockTable` to build `columnDefs` from registry × visible prefs, keeping structural columns always (R1, P5)
  - [ ] 2.3 Create `components/common/ColumnCustomizer.tsx` — grouped checklist popover (R1)

- [ ] 3. Radar axis customization
  - [ ] 3.1 Create `client/src/utils/radarTemplate.ts` — `addAxis` (neutral default), `removeAxis` (keep ≥1), `activeAxes` (R2, P4, P8)
  - [ ] 3.2 Restyle `AdvancedSettingsPanel` — per-axis enable/rename/remove + "Add axis" + inline validation (R4)
  - [ ] 3.3 Ensure removing/adding axes flows through existing `/radar/*` calls unchanged (R2, P2)

- [ ] 4. Health color fix
  - [ ] 4.1 Create `client/src/utils/healthColor.ts` — average-based thresholds (R3, P3)
  - [ ] 4.2 Replace hardcoded 300/400/600 logic in `StockTable` radar cell and `StockPage` radar (R3, P3)

- [ ] 5. Tests
  - [ ] 5.1 Frontend `useTablePreferences.test.tsx` — persist/restore (P6), can't remove last column (P4), default set (P10)
  - [ ] 5.2 Frontend `healthColor.test.ts` — same color for 3-axis vs 6-axis equivalent averages (P3)
  - [ ] 5.3 Frontend `radarTemplate.test.ts` — add neutral axis no NaN (P8), remove keeps others (P2), can't remove last (P4)
  - [ ] 5.4 Frontend `AdvancedSettingsPanel.test.tsx` — add/remove axis reflected in radar; suggestion opt-in only (P7)
