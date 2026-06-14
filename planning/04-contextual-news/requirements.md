# Requirements — Contextual News

> Derived from `design.md`. Property tags reference design Correctness Properties.

---

## R1 — Ticker-scoped news feed
**User story:** As a user, I want the news feed to show stories about the stocks I'm viewing/holding, so that the news is relevant to me.

**Acceptance criteria:**
- THE SYSTEM SHALL fetch news via `NEWS_SENTIMENT?tickers={selected}` when in portfolio mode.
- THE SYSTEM SHALL scope to selected tickers, falling back to all portfolio tickers when nothing is explicitly selected.
- WHEN there are no tickers (empty portfolio), THE SYSTEM SHALL fall back to the existing category feed (P1).
- THE SYSTEM SHALL dedupe articles by URL and drop placeholder titles (P8).

## R2 — Sentiment badges
**User story:** As a user, I want a Bullish/Bearish badge on each headline, so that I can gauge tone quickly.

**Acceptance criteria:**
- THE SYSTEM SHALL derive the badge label from the API score via the documented thresholds (P2).
- IF a score is missing/unparseable, THE SYSTEM SHALL render Neutral, never a fabricated Bull/Bear (P5).
- WHEN per-ticker sentiment exists for a selected ticker, THE SYSTEM SHALL prefer that over the article's overall sentiment (P7).

## R3 — Refresh on selection change
**User story:** As a user, I want the feed to update when I add or select a stock, so that it stays current.

**Acceptance criteria:**
- WHEN the selected/added ticker set changes, THE SYSTEM SHALL refetch contextual news (P3).
- THE SYSTEM SHALL coalesce rapid selection changes into a single in-flight request, discarding superseded responses (P6).

## R4 — Caching & failures
**Acceptance criteria:**
- THE SYSTEM SHALL cache by the sorted ticker set (order-independent, bounded) for 15 minutes (P4).
- WHEN Alpha Vantage returns a rate-limit payload, THE SYSTEM SHALL return 429 and the UI SHALL show a clear "try again later" state (P9).
