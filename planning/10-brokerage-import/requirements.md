# Requirements — Brokerage Portfolio Import (Stretch)

> Derived from `design.md`. Property tags reference design Correctness Properties. Stretch feature — prioritize after the core set.

---

## R1 — Connect a brokerage (read-only)
**User story:** As a user, I want to connect my brokerage (e.g. Robinhood) and import my holdings, so that I can analyze what I actually own.

**Acceptance criteria:**
- THE SYSTEM SHALL connect via an aggregator's hosted flow with read-only (positions) scope and SHALL never obtain trading permission or the broker password (P1).
- THE SYSTEM SHALL store aggregator tokens encrypted at rest and never expose them to the client (P2).

## R2 — Sync holdings
**User story:** As a user, I want my holdings kept up to date.

**Acceptance criteria:**
- THE SYSTEM SHALL reconcile holdings idempotently on each sync (upsert present, remove vanished) (P3).
- THE SYSTEM SHALL ingest each holding's symbol into `StockMaster` so radar/metrics work (P6).
- IF a symbol can't be resolved, THE SYSTEM SHALL keep the holding and skip enrichment rather than failing the whole sync (P4).
- THE SYSTEM SHALL expose `last_synced` and flag stale data in the UI (P11).

## R3 — Holdings table & performance
**User story:** As a user, I want a second table of my real holdings with radars and my real performance.

**Acceptance criteria:**
- THE SYSTEM SHALL render holdings in a table mirroring the main table plus quantity/avg-cost/market-value/unrealized-P&L columns, with per-row radar (P6).
- THE SYSTEM SHALL compute performance from broker-provided cost basis only, never self-reported (P5).

## R4 — Community credibility
**User story:** As a user, I want to see how people really perform and the templates they used.

**Acceptance criteria:**
- THE SYSTEM SHALL show community performance only for verified, synced connections (P8).
- THE SYSTEM SHALL keep holdings private by default; publishing is explicit opt-in (P7).
- WHEN publishing, THE SYSTEM SHALL share performance % + template used (optionally anonymized) and SHALL NOT expose raw balances/account identifiers unless explicitly chosen (P9).

## R5 — Disconnect
**Acceptance criteria:**
- WHEN a user disconnects, THE SYSTEM SHALL purge stored credentials and (per user choice) imported holdings (P10).
