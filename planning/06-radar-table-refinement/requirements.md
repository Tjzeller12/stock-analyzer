# Requirements — Radar & Table Refinement

> Derived from `design.md`. Property tags reference design Correctness Properties.

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
