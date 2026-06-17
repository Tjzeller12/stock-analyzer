# Requirements — Thematic Global-News Discovery Cards

> Derived from `design.md`. Property tags reference design Correctness Properties.

---

## R1 — Weekly thematic cards
**User story:** As a user, I want cards for the week's big news themes (e.g. "War in Iran", "AI Bubble") each listing impacted stocks, so that I can discover timely ideas.

**Acceptance criteria:**
- THE SYSTEM SHALL generate up to ~6 themes on a weekly schedule, each with a title, summary, and ≤5 stocks with a one-line rationale.
- THE SYSTEM SHALL bound theme/stock counts and rationale length, dedupe and validate tickers (P5, P6).
- THE SYSTEM SHALL show "Updated <date>" per the week's generation.

## R2 — Fast, deterministic serving
**User story:** As a user, I want the cards to load instantly and be the same for everyone that week.

**Acceptance criteria:**
- THE SYSTEM SHALL serve themes from the DB with no Claude call on the request path (P1).
- THE SYSTEM SHALL serve the current ISO-week's active themes, with a fixed-timezone week boundary (P8).
- WHEN no themes exist yet, THE SYSTEM SHALL render a friendly empty state (P10).

## R3 — Resilient generation
**Acceptance criteria:**
- THE SYSTEM SHALL make weekly generation idempotent per ISO week and single-flight across workers (P2, P7).
- WHEN generation or parsing fails, THE SYSTEM SHALL leave the previous good themes active (P3).
- THE SYSTEM SHALL activate a new week's themes atomically (no half-written week visible) (P4).

## R4 — Add stocks from a card
**User story:** As a user, I want a ＋ button on each themed stock, so that I can add it to my list.

**Acceptance criteria:**
- THE SYSTEM SHALL provide the shared `AddToListButton` per stock, reusing the existing add path (idempotent if already held) (P9).
- WHEN a stock card is opened, THE SYSTEM SHALL navigate to `/stock/:symbol`.
