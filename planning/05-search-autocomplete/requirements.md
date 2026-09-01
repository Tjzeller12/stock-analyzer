# Requirements — Search Autocomplete

> Shipped as live remote search. Criteria below describe the optional local-index design.

---

## R1 — Instant local-first search
**User story:** As a user, I want ticker/company suggestions as I type, so that I can add the right stock without guessing the exact symbol.

**Acceptance criteria:**
- THE SYSTEM SHALL resolve queries against an in-memory index with no network call for indexed symbols (P1).
- THE SYSTEM SHALL load the symbol index at most once per version (P5).
- THE SYSTEM SHALL match case- and whitespace-insensitively (P8).
- THE SYSTEM SHALL rank matches deterministically: exact > ticker-prefix > name-prefix > substring > fuzzy (P7).

## R2 — Remote fallback
**User story:** As a user, I want obscure/newly-listed symbols found too, so that search is complete.

**Acceptance criteria:**
- THE SYSTEM SHALL call `SYMBOL_SEARCH` only when local results are below threshold, after debounce (P2, P3).
- THE SYSTEM SHALL discard responses for superseded queries (P3).
- IF the index fails to load, THE SYSTEM SHALL operate in remote-only mode; IF remote fails, local results SHALL still render (P6).

## R3 — Selection
**User story:** As a user, I want selecting a result to add the stock (or navigate), so that the flow is one step.

**Acceptance criteria:**
- THE SYSTEM SHALL only emit a validated symbol from the index or a confirmed remote match (P4).
- THE SYSTEM SHALL invoke the same `addStock` path on selection (no parallel add logic).
- THE SYSTEM SHALL make keyboard (Enter on highlight) and click selection equivalent (P9).
