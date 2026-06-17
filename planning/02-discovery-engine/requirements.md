# Requirements — Discovery Engine

> Derived from `design.md`. Property tags reference design Correctness Properties.

---

## R1 — Super Prompt generation
**User story:** As a user, I want a personalized list of long-term stock ideas, so that I can discover candidates that fit my profile.

**Acceptance criteria:**
- THE SYSTEM SHALL build the prompt by interpolating the bounded profile context (feature 01) into a master template.
- IF the user has no completed profile, THE SYSTEM SHALL still produce a sensible generic long-term list (P1).
- THE SYSTEM SHALL call Claude with tools enabled to verify tickers.
- THE SYSTEM SHALL enforce a strict JSON schema (array of `{ticker, company_name, rationale, sector?}`) and SHALL return `[]` rather than erroring on malformed output (P2).
- THE SYSTEM SHALL dedupe tickers and cap the result count (P2).

## R2 — Tailored Discovery page
**User story:** As a user, I want the recommendations rendered as clickable cards, so that I can explore them.

**Acceptance criteria:**
- THE SYSTEM SHALL render each recommendation as a card with ticker, name, and rationale.
- WHEN a card is clicked, THE SYSTEM SHALL navigate to `/stock/:ticker`.
- THE SYSTEM SHALL show skeleton loaders while a run is in flight and SHALL never leave skeletons after a request settles (P8).
- THE SYSTEM SHALL render an empty/error state when no recommendations are returned.
- THE SYSTEM SHALL provide a ＋ Add-to-list button on each card using the shared add path (P12).

## R3 — Conversational Refine Search
**User story:** As a user, I want to refine recommendations in natural language (e.g. "Exclude EV companies"), so that I can steer results.

**Acceptance criteria:**
- THE SYSTEM SHALL provide a chat-style input that appends a modifier to the active refinement list.
- THE SYSTEM SHALL preserve refinement order and keep prior refinements (append-only) (P4).
- THE SYSTEM SHALL cap the number of refinements on both client and server (P5).
- WHEN a refinement is submitted, THE SYSTEM SHALL show skeleton loaders and replace the grid with the new payload.

## R4 — Cost control & reproducibility
**User story:** As the operator, I want discovery to be cache-backed, so that costs are bounded and results are reproducible.

**Acceptance criteria:**
- THE SYSTEM SHALL cache results keyed by `(profile_signature, refinements_hash)` and return the cache within TTL (P7).
- THE SYSTEM SHALL only cache non-empty, cacheable results (P7).
- THE SYSTEM SHALL never mutate portfolio state during generation/refinement (P9).
- THE SYSTEM SHALL bound each rationale to ≤ 2 sentences (P10).
