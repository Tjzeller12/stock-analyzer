# Tasks — Search Autocomplete

> (Rn) requirement · (Pn) property.

- [ ] 1. Server: index + search routes
  - [ ] 1.1 Add `SYMBOL_SEARCH = "SYMBOL_SEARCH"` to `AlphaVantageFunction` in `constants.py` (R2)
  - [ ] 1.2 Add `GET /data/symbol_index` — `build_symbol_index()` (StockMaster ∪ seed), versioned, long cache (R1, P5)
  - [ ] 1.3 Add `POST /data/symbol_search` — `normalize_symbol_search(bestMatches)`, 24h cache (R2)
  - [ ] 1.4 Add a bundled seed list asset of common US tickers (R1)

- [ ] 2. Client: types & hook
  - [ ] 2.1 Add `SymbolMatch`, `SymbolIndexEntry` to `types.ts`
  - [ ] 2.2 Create `client/src/hooks/useSymbolSearch.tsx` — load+cache index in `localStorage` by version (P5), synchronous local ranking (P1, P7), debounced stale-guarded remote fallback (P2, P3), graceful degradation (P6)
  - [ ] 2.3 Add `SYMBOL_INDEX` / `SYMBOL_SEARCH` endpoints to `constants/api.ts`

- [ ] 3. Client: component & wiring
  - [ ] 3.1 Create `components/common/SearchAutocomplete.tsx` — combobox, keyboard+mouse nav, match highlighting, ARIA (R3, P9)
  - [ ] 3.2 Replace the raw add input in `StockTable`/`ControlPanel` with `SearchAutocomplete` (mode="add") wired to `onAdd` (R3, P4)

- [ ] 4. Tests
  - [ ] 4.1 Frontend `useSymbolSearch.test.tsx` — local-only for indexed query (P1), deterministic ranking (P7), case/space-insensitive (P8), remote only on miss + stale-guard (P2, P3), degradation (P6)
  - [ ] 4.2 Frontend `SearchAutocomplete.test.tsx` — keyboard == click selection (P9), only valid symbol emitted (P4)
  - [ ] 4.3 Backend — `normalize_symbol_search` maps AV `bestMatches`; index versioning stable
