# Design — Search Autocomplete (Alpha Vantage SYMBOL_SEARCH)

> **Status:** Design (awaiting alignment) · **Owner:** TBD · **Last updated:** 2026-06-13
>
> Scope: a high-performance ticker search/autocomplete on the MainPage. Typing resolves instantly against a **local in-memory index** (no network for common tickers), falling back to the Alpha Vantage `SYMBOL_SEARCH` endpoint only for misses. Selecting a result adds the stock (reusing the existing `addStock`) or navigates to it.
>
> **Reuses:** the existing add-stock flow (`useStockTableManager.addStock` → `PORTFOLIO_ENDPOINTS.ADD`), the `authPost` helper, and the existing data-route blueprint. This is a moderate feature, not a new engine.

---

## 1. Architecture

### 1.1 Where this fits

Today, adding a stock is a raw text input in `StockTable` (`onAdd(symbol)`) — the user must already know the exact ticker, and a typo becomes a `400`. This feature inserts a reusable `SearchAutocomplete` in front of that action: instant suggestions while typing, with company names and exchange info, so the user picks a real symbol instead of guessing.

"High-performance **local** search" means: we don't hit the network on every keystroke. The client holds a compact **symbol index** (ticker + name + region + type) and resolves queries in memory (prefix/substring/fuzzy). The `SYMBOL_SEARCH` API is only consulted when the local index can't satisfy the query (e.g. obscure or newly listed symbols), and those remote results are debounced and cached.

```
┌──────────────────────── CLIENT (React) ────────────────────────┐
│  MainPage / StockTable add-control                              │
│    <SearchAutocomplete onSelect=… />                            │
│       useSymbolSearch()                                         │
│         ├─ index: SymbolIndex (loaded once, in memory)          │
│         ├─ local query → ranked matches (0 network)             │
│         └─ on local-miss → debounced POST /data/symbol_search   │
│       dropdown: keyboard + mouse nav, match highlighting        │
│            onSelect(symbol) → addStock(symbol) | navigate       │
└────────────┼────────────────────────────────────────────────-─┘
             ▼
┌──────────────────────── SERVER (Flask) ─────────────────────────┐
│  data_bp                                                         │
│   ├─ GET  /data/symbol_index      (cached, long TTL)            │
│   │     compact list for the client to build its local index    │
│   └─ POST /data/symbol_search { q }                            │
│         cache hit (symsearch:q)? → return                       │
│         raw = SYMBOL_SEARCH(keywords=q)                          │
│         return normalized matches; cache 24h                     │
└──────────────────────────────────────────────────────────────--┘
```

### 1.2 Key architectural decisions

- **Local-first, remote-fallback.** The local index answers the overwhelming majority of queries with zero latency and zero API cost. `SYMBOL_SEARCH` is a fallback for local misses only. This is the core performance property (**P1**, **P2**).

- **The symbol index is served once and cached hard.** `GET /data/symbol_index` returns a compact array the client fetches once per session (and can persist to `localStorage` with a version stamp). Source of the index: the symbols already known to the app (`StockMaster`) unioned with a bundled seed list of common US tickers. It is *not* fetched per keystroke. See **P5**.

- **Ranking is deterministic and tiered.** Matches are ordered exact-ticker → ticker-prefix → name-prefix → substring → fuzzy, with ties broken stably. Same query + same index always yields the same ordering. See **P7**.

- **Remote calls are debounced and stale-guarded.** Only a settled query (≈200ms) that missed locally triggers a request; superseded responses are discarded so the dropdown always reflects the latest input. See **P3**.

- **Selection always resolves to a real symbol.** The dropdown only emits a symbol from the index or a confirmed `SYMBOL_SEARCH` result, so `onSelect` can't feed a garbage string into `addStock`. See **P4**.

- **Graceful degradation.** If the index fails to load, search falls back to remote-only mode (still works, just chattier). If remote fails, local results still render. See **P6**.

### 1.3 Data flow

1. On mount, `useSymbolSearch` loads the index (from `localStorage` if fresh, else `GET /data/symbol_index`) and builds an in-memory structure.
2. Keystrokes update the query; the hook computes local ranked matches synchronously.
3. If local matches are below a confidence/count threshold, a debounced `POST /data/symbol_search { q }` augments results.
4. User navigates with arrow keys / mouse and selects → `onSelect(symbol)` → `addStock(symbol)` (or navigate to `/stock/:symbol`).

---

## 2. Components and Interfaces

### 2.1 Shared types (client) — `client/src/types.ts` additions

```typescript
export interface SymbolMatch {
  symbol: string;        // "AAPL"
  name: string;          // "Apple Inc."
  region?: string;       // "United States"
  type?: string;         // "Equity"
  currency?: string;     // "USD"
  source: "local" | "remote";
  score: number;         // ranking score (higher = better), deterministic
}

export interface SymbolIndexEntry {
  symbol: string;
  name: string;
  region?: string;
  type?: string;
}
```

### 2.2 `useSymbolSearch` hook — `client/src/hooks/useSymbolSearch.tsx`

```typescript
export interface UseSymbolSearch {
  query: string;
  setQuery: (q: string) => void;
  matches: SymbolMatch[];       // ranked, deduped by symbol
  loading: boolean;             // true only while a remote fallback is in flight
  indexReady: boolean;
  error: string | null;
  reset: () => void;
}

export function useSymbolSearch(opts?: {
  minRemoteFallbackChars?: number;   // default 1–2
  localResultThreshold?: number;     // below this, trigger remote (default 3)
  debounceMs?: number;               // default 200
}): UseSymbolSearch;
```

Contract: local matching is synchronous and never sets `loading`. `loading` is only true during a remote fallback request and is cleared in `finally`. Remote responses for a query that is no longer current are dropped.

### 2.3 Component — `client/src/components/common/SearchAutocomplete.tsx`

```typescript
interface SearchAutocompleteProps {
  onSelect: (symbol: string) => void;     // → addStock or navigate
  placeholder?: string;                    // e.g. "Search ticker or company…"
  autoFocus?: boolean;
  mode?: "add" | "navigate";               // what selection does
}
// Renders an input + dropdown. Keyboard: ArrowUp/Down move highlight, Enter selects,
// Escape closes. Mouse hover mirrors keyboard highlight. Match substrings are bolded.
// ARIA combobox roles for accessibility.
```

### 2.4 Server — routes + service

```python
# server/app/routes/stock_data.py  (new routes)

@bp.route("/symbol_index", methods=["GET"])
@login_required
def symbol_index():
    """Compact symbol list for the client's local index. Long-cached and
    versioned so the client only refetches when it changes."""
    cached = cache.get("symbol_index")
    if cached:
        return jsonify(cached), 200
    entries = build_symbol_index()      # StockMaster symbols ∪ bundled seed list
    payload = {"version": _index_version(entries), "entries": entries}
    cache.set("symbol_index", payload, timeout=86_400)
    return jsonify(payload), 200

@bp.route("/symbol_search", methods=["POST"])
@login_required
def symbol_search():
    q = (request.json or {}).get("q", "").strip()
    if not q:
        return jsonify({"matches": []}), 200
    key = f"symsearch:{q.lower()}"
    cached = cache.get(key)
    if cached:
        return jsonify(cached), 200
    raw = get_av_json(AlphaVantageFunction.SYMBOL_SEARCH, keywords=q)
    matches = normalize_symbol_search(raw)     # AV "bestMatches" → SymbolMatch dicts
    payload = {"matches": matches}
    cache.set(key, payload, timeout=86_400)
    return jsonify(payload), 200
```

> `AlphaVantageFunction.SYMBOL_SEARCH = "SYMBOL_SEARCH"` to be added to `constants.py`. AV returns `bestMatches[]` with keys like `"1. symbol"`, `"2. name"`, `"4. region"`, `"3. type"`, `"8. currency"`; `normalize_symbol_search` maps those to `SymbolMatch`.

---

## 3. Data Models

### 3.1 No new SQL tables

The symbol index is derived (`StockMaster` ∪ a bundled seed asset) and cached in Redis with a long TTL; the client caches it in `localStorage` keyed by `version`. Remote search results are cached in Redis per query (24h). Nothing is persisted relationally.

### 3.2 JSON payload shapes

```jsonc
// GET /data/symbol_index response
{ "version": "av-seed-2026-06+sm-1421", "entries": [ { "symbol": "AAPL", "name": "Apple Inc.", "region": "United States", "type": "Equity" } ] }

// POST /data/symbol_search request / response
{ "q": "appl" }
{ "matches": [ { "symbol": "AAPL", "name": "Apple Inc.", "region": "United States", "type": "Equity", "currency": "USD", "source": "remote", "score": 0.9 } ] }
```

---

## 4. Correctness Properties

### P1 — Local hits are a zero-network no-op
A query satisfied by the local index resolves entirely in memory and issues no HTTP request. Typing a common ticker never touches the API, so it is instant and free regardless of network conditions.

### P2 — Remote fallback fires only on local insufficiency
A `SYMBOL_SEARCH` request is issued only when local results fall below the configured count/confidence threshold (and after debounce). Adequate local results suppress the network call entirely.

### P3 — Search is debounced and stale-guarded
Remote requests fire only for a settled query, and a response for a query that is no longer the current input is discarded. The rendered dropdown always corresponds to the latest keystrokes; out-of-order responses can't flicker stale matches in.

### P4 — Selection always yields a valid symbol
The dropdown can only emit a `symbol` that came from the index or a confirmed remote match. `onSelect` therefore never passes an unvalidated free-text string to `addStock`, eliminating the "typo → 400" failure mode of the current raw input.

### P5 — The index is loaded at most once per version
The client fetches the symbol index once and reuses it for the session (and across sessions via `localStorage` until `version` changes). It is never refetched per keystroke or per search.

### P6 — Degrades gracefully on partial failure
If the index fails to load, the component operates in remote-only mode (still functional). If a remote call fails, local matches still render and the failure is surfaced quietly, not as a hard error. Search is never fully broken by a single dependency failure.

### P7 — Ranking is deterministic and tiered
For a fixed query and index, match ordering is fully determined: exact ticker > ticker prefix > name prefix > substring > fuzzy, with a stable tiebreak. The same input always produces the same ordered list, making the UI predictable and the ranking unit-testable.

### P8 — Matching is case- and whitespace-insensitive
Queries are normalized (trim + casefold) before matching, so "aapl", "AAPL", and " Aapl " produce identical results. Highlighting maps back to the original-cased display string.

### P9 — Keyboard and pointer selection are equivalent
Selecting via Enter on the highlighted row and clicking the same row invoke `onSelect` with the identical symbol. Highlight state is shared between keyboard and hover so the two interaction modes never disagree.

---

## 5. Resolved decisions (confirmed)

1. **Local-first with remote fallback** (not pure proxy-on-every-keystroke).
2. **Index source = `StockMaster` ∪ bundled seed list**, served via `/data/symbol_index`, cached client + server.
3. **Selection reuses the existing `addStock`** (no parallel add path); a `navigate` mode is available for a global search use.
4. **Remote per-query cache 24h**, index cache 24h server-side + versioned `localStorage` client-side.
