# Requirements — Personalization & Onboarding

> Derived from `design.md`. Acceptance criteria use EARS-style "WHEN/THE SYSTEM SHALL". Property tags (P1–P12) reference the design's Correctness Properties.

---

## R1 — Multi-step investor questionnaire
**User story:** As a new user, I want a clean multi-step questionnaire that asks scenario-based questions, so that the app can understand my behavioral risk tolerance without boring bank-form questions.

**Acceptance criteria:**
- WHEN a new user finishes registration and their profile is incomplete, THE SYSTEM SHALL redirect them to `/onboarding`.
- THE SYSTEM SHALL present one step at a time with a visible progress indicator.
- THE SYSTEM SHALL prevent advancing past a step whose required input is missing.
- THE SYSTEM SHALL allow the user to skip onboarding entirely and still reach `/main` (P4).
- WHEN the user reloads or reopens the tab mid-flow, THE SYSTEM SHALL restore their in-progress answers and current step (P3).

## R2 — Behavioral answers → deterministic risk/horizon tags
**User story:** As a user, I want my answers turned into a clear risk profile (e.g. "Aggressive", "10+ Years"), so that the app can personalize recommendations.

**Acceptance criteria:**
- THE SYSTEM SHALL map answers to a `risk_tolerance_score` (0–100) and a `risk_tag` deterministically, with no AI (P2).
- THE SYSTEM SHALL map the horizon answer to a `horizon_tag`.
- IF a behavioral question is unanswered, THE SYSTEM SHALL treat it as the neutral midpoint and never produce NaN (P10).
- WHEN a more aggressive option is chosen for any one question, THE SYSTEM SHALL never decrease the aggregate risk score (P9).
- THE SYSTEM SHALL show a preview of derived tags on the Review step that matches the server result.

## R3 — Budget capture
**User story:** As a user, I want to set my investment budget, so that features can prioritize stocks in my price range.

**Acceptance criteria:**
- THE SYSTEM SHALL accept a non-negative budget value.
- WHEN the budget is below the low-budget threshold, THE SYSTEM SHALL surface index-fund guidance (informational; consumed later by feature 07).
- THE SYSTEM SHALL keep `User.budget` and `InvestorProfile.budget` equal after any save (P8).

## R4 — Sector "Pros & Cons" selection matrix
**User story:** As a user, I want to pick the sectors I'm interested in while seeing each sector's upside and risks, so that I make an informed choice.

**Acceptance criteria:**
- THE SYSTEM SHALL display the major sectors in a grid/list.
- WHEN a user hovers/focuses/taps a sector card, THE SYSTEM SHALL reveal the "Pitch" (pros) and "Reality Check" (cons).
- THE SYSTEM SHALL allow selecting at most 3 sectors and SHALL disable further selection once 3 are chosen (P5).
- THE SYSTEM SHALL reject (400) any save attempt with more than 3 sectors or unknown sector keys (P5, P12).
- THE SYSTEM SHALL use canonical sector keys that match `StockMaster.sector` (P12).

## R5 — Persist & update profile
**User story:** As a user, I want my finalized profile saved and editable later, so that I'm not locked into my first answers.

**Acceptance criteria:**
- WHEN the user finishes onboarding, THE SYSTEM SHALL persist the profile in a single atomic transaction (P6).
- THE SYSTEM SHALL make `PUT /profile/investor` idempotent (one profile row per user, repeat-safe) (P1).
- THE SYSTEM SHALL expose the same step UI inside `/profile` for editing the profile later.
- WHEN onboarding succeeds, THE SYSTEM SHALL clear the local draft.

## R6 — Personalization propagation
**User story:** As a user, I want my profile to make the rest of the app feel tailored to me.

**Acceptance criteria:**
- THE SYSTEM SHALL expose `build_profile_context(user)` returning a bounded, fixed-schema string (≤ ~400 chars) for prompt injection, or "" when no completed profile (P11, P1-feature02).
- THE SYSTEM SHALL expose `suggest_default_template(profile)` as a lookup into the seeded defaults (feature 08). It never writes templates. First-run auto-apply is owned by 08 and only runs when the user has no owned templates (P7, 08-P15).
- THE SYSTEM SHALL expose `budget_band(profile)` returning `micro|standard|high` for downstream use.
