# Requirements — Radar & Table Refinement

> Next feature. Derived from `design.md`.

---

## R1 — Customizable table columns
**User story:** As a user, I want the table to ship with the common statistics and let me add/remove columns, so that I see what matters to me.

**Acceptance criteria:**
- THE SYSTEM SHALL render columns from a registry, with a deterministic default common-stats set when no prefs exist (P10).
- THE SYSTEM SHALL let the user toggle column visibility via a grouped customizer.
- WHEN a column is hidden, THE SYSTEM SHALL not drop the underlying data (P1).
- THE SYSTEM SHALL always keep structural columns (radar, symbol, select, remove) present and pinned (P5).
- THE SYSTEM SHALL refuse to remove the last data column (P4).
- THE SYSTEM SHALL persist and restore column prefs across reloads (P6).

## R2 — Removable radar axes
**User story:** As a user, I want to remove radar axes I don't care about, so that I can focus on just the ones I use.

**Acceptance criteria:**
- THE SYSTEM SHALL treat the active axis set as the keys of the `RadarTemplate.equations`.
- WHEN an axis is removed, THE SYSTEM SHALL leave the remaining axes' scores unchanged (P2).
- THE SYSTEM SHALL refuse to remove the last axis (P4).
- WHEN an axis is added, THE SYSTEM SHALL default it to a safe neutral equation that never yields NaN (P8).
- THE SYSTEM SHALL drive both the in-row mini radar and the detail radar from the same axis set (P9).

## R3 — Axis-count-invariant health color
**User story:** As a user, I want the radar health color to make sense regardless of how many axes I keep.

**Acceptance criteria:**
- THE SYSTEM SHALL compute the traffic-light color from the average active-axis score, not a fixed 600 sum (P3).
- THE SYSTEM SHALL apply this in both `StockTable` and `StockPage`.

## R4 — Advanced panel restyle
**User story:** As a user, I want the equation builder to be clearer, so that editing formulas is less intimidating.

**Acceptance criteria:**
- THE SYSTEM SHALL group axes with per-axis enable/rename/remove controls and an "Add axis" action.
- THE SYSTEM SHALL show inline validation state for each formula before "Apply".
- THE SYSTEM SHALL not let personalization suggestions overwrite user prefs without explicit opt-in (P7).
- THE SYSTEM SHALL style the panel with theme tokens so labels, chips, and help text are readable in light mode (P13).

## R5 — MainPage density
**User story:** As a user, I want the dashboard to show analysis I asked for, not a long page of empty cards.

**Acceptance criteria:**
- THE SYSTEM SHALL not render Compare Radar, Portfolio Distribution, or Comparison Analysis until a compare has been started or a prior result is restored (P11).
- THE SYSTEM SHALL keep News visible independently of compare state.

## R6 — Compare jumps to charts, then analysis fills in
**User story:** As a user, I want Compare to show me the radar right away so I have something to look at while the write-up loads.

**Acceptance criteria:**
- WHEN the user clicks Compare, THE SYSTEM SHALL scroll `#compare-results` into view immediately (P12).
- THE SYSTEM SHALL place Radar and Portfolio Distribution **before** Comparison Analysis in that region (P12).
- THE SYSTEM SHALL render the radar as soon as `/radar/compare` scores exist, without waiting for the analysis stream (P14).
- THE SYSTEM SHALL render the distribution chart as soon as its own data exists (Claude doughnut today; allocation engine in feature 07), without waiting for the analysis markdown (P14).
- THE SYSTEM SHALL let Comparison Analysis show its own loading/streaming state independently.

## R7 — One picker for every stock table
**User story:** As a user, I want column choices to apply to Watchlist and My Portfolio together.

**Acceptance criteria:**
- THE SYSTEM SHALL drive metric columns from one registry × one `visibleColumns` list.
- THE SYSTEM SHALL keep table-specific structural columns (remove vs qty/cost/PnL) out of the picker.
