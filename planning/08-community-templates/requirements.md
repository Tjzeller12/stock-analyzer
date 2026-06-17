# Requirements — Community Analysis Templates & Saveable Preferences

> Derived from `design.md`. Property tags reference design Correctness Properties.

---

## R1 — Save current view as a template
**User story:** As a user, I want to save my current analysis configuration as a named template, so that I can reuse it.

**Acceptance criteria:**
- THE SYSTEM SHALL capture the full config (radar equations + normalization + scope + active axes + visible columns) (P3).
- THE SYSTEM SHALL store Title (≤100) and Description (≤255) (P10).
- THE SYSTEM SHALL validate config before persistence (P9).

## R2 — Apply templates
**User story:** As a user, I want to apply a template and have the table and radar update instantly.

**Acceptance criteria:**
- WHEN a template is applied, THE SYSTEM SHALL update both AG Grid column visibility and the radar/precedence state in one action (P3).
- THE SYSTEM SHALL apply non-destructively (no saved template is altered) (P2).

## R3 — Default templates
**User story:** As a casual user, I want ready-made templates (e.g. "Warren Buffett Value", "High-Risk Tech"), so that I can start fast.

**Acceptance criteria:**
- THE SYSTEM SHALL seed 3–4 defaults idempotently at startup (P1).
- THE SYSTEM SHALL make defaults read-only/undeletable; editing a default SHALL clone it into an owned template (P5, P6).

## R4 — Sharing & ownership
**User story:** As a user, I want to share my templates and use others', safely.

**Acceptance criteria:**
- THE SYSTEM SHALL enforce ownership on edit/delete/share (403 otherwise) (P4).
- THE SYSTEM SHALL make public templates read-only to non-owners; "using" one clones it (P6, P7).

## R5 — Starring (social signal)
**User story:** As a user, I want to star templates I like and sort by most-liked, so the community page feels like a social feed.

**Acceptance criteria:**
- THE SYSTEM SHALL allow at most one star per user per template; re-starring/unstarring is idempotent (P11).
- THE SYSTEM SHALL keep `star_count` consistent with the star rows and never negative (P12).
- THE SYSTEM SHALL allow sorting the community list by stars, verified return, or newest (P13).
- THE SYSTEM SHALL not alter template config when starred/unstarred (P14).

## R6 — Performance signals
**User story:** As a user, I want to trust templates based on real outcomes, not claims.

**Acceptance criteria:**
- THE SYSTEM SHALL display verified return only when backed by brokerage data (feature 10); otherwise omit it (P8).
- THE SYSTEM SHALL present stars and verified return as independent signals (P13).
