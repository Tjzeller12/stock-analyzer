# Design — Peer Matchmaker (StockPage Discovery Module)

> **Status:** Design (awaiting alignment) · **Owner:** TBD · **Last updated:** 2026-06-13
>
> Scope: a "Peers & Competitors" module on the individual Stock Page that fights familiarity bias. For the stock being viewed it uses Claude (seeded with the stock's sector/industry + cached fundamentals) to surface 3–5 direct competitors, shows high-level comparison metrics (market cap, P/E, debt-to-equity), offers a one-click route into the existing deep-comparison tool, and includes a brief AI insight ("While you're looking at Oracle, Microsoft shows stronger free cash flow…").
>
> **Depends on / reuses:** the existing AI layer (`StructuredAlphaBotAnalysis`, `PromptTemplate`, `AlphaBotClient`), `StockMaster` cached fundamentals, the stock-ingest path in `stock_manager`, and the existing compare flow (`useCompareAlphaBotManager`, which is driven by the `selectedSymbols` localStorage key on `/main`).

---

## 1. Architecture

### 1.1 Where this fits

The Stock Page (`/stock/:symbol`) already renders `StockHeader`, `EventPulseChart`, `StockMetricsTable`, an AlphaBot analysis/chat panel, and a per-stock radar. Peer Matchmaker is a **new card** on that page. Crucially, `StockMaster` already stores `sector` and `industry` for the viewed stock, so step 1 of the acceptance criteria ("fetch COMPANY_OVERVIEW to identify sector/industry") is usually a **cache read**, with a live `OVERVIEW` fetch only as fallback.

The competitor lookup is a textbook `StructuredAlphaBotAnalysis` subclass: render a prompt with the subject's identity + industry, get back strict JSON, parse tolerantly.

```
┌──────────────────────── CLIENT (React) ────────────────────────┐
│  /stock/:symbol  → StockPage                                    │
│    <PeerMatchmakerCard symbol=… subjectMetrics=… />             │
│       ├─ usePeerMatchmaker(symbol)                              │
│       ├─ summary insight (StyledMarkdown)                       │
│       └─ <PeerRow/> × 3–5  (metrics + "Compare" button)         │
│            │ GET  /alphaBot/peers?symbol=…                      │
│            │ "Compare" → prepareCompare(subject, peer)          │
│            │            → set localStorage selectedSymbols      │
│            │            → navigate("/main")  (existing tool)    │
└────────────┼────────────────────────────────────────────────-─┘
             ▼
┌──────────────────────── SERVER (Flask) ─────────────────────────┐
│  alphaBot_bp                                                     │
│   ├─ POST /alphaBot/peers     { stock_symbol }                  │
│   │     subject = StockMaster.get(symbol)  (sector/industry)    │
│   │     cache hit (peers:SYMBOL)? → return                      │
│   │     recs = PeerAnalysis().analyze(subject)  (strict JSON)   │
│   │     enrich each peer w/ cached StockMaster metrics if known │
│   │     cache.set(peers:SYMBOL, …, 24h)                         │
│   └─ POST /portfolio/prepare_compare { symbols }  (optional)    │
│         ensure each symbol exists in StockMaster (idempotent     │
│         ingest via stock_manager) so compare/radar can run      │
│                                                                  │
│  alphaBot/analysis.py → class PeerAnalysis(StructuredAlphaBot…) │
│  prompts/peer_matchmaker.md                                      │
└──────────────────────────────────────────────────────────────--┘
```

### 1.2 Key architectural decisions

- **Reuse `StructuredAlphaBotAnalysis`.** `PeerAnalysis` subclasses the existing base, sets `prompt_path = PEER_MATCHMAKER_PROMPT`, implements `build_placeholders(stock)` and `default_result()`. We get the shared tolerant JSON parse, error handling, and `default_result()` fallback for free. No new AI plumbing.

- **Metrics are sourced, not fabricated.** For each peer Claude returns, the comparison metrics (market cap, P/E, debt-to-equity) are taken from **cached `StockMaster`** when the peer is already known. When unknown, the server either (a) does a lightweight enrich or (b) marks the metric `null` and the UI renders "—". We never silently render `0` as if it were real data. See **P3**.

- **"Compare" bridges to the existing tool, it doesn't reinvent it.** The deep-comparison tool already lives on `/main`, driven by the `selectedSymbols` localStorage set consumed by `useCompareAlphaBotManager`. The peer "Compare" button writes `[subjectSymbol, peerSymbol]` into that key and navigates to `/main`. Because the compare + radar endpoints query `StockMaster` by symbol, a peer that isn't cached must be **ingested first** — handled by an idempotent `prepare_compare` step. See **P5**.

- **Cache per subject symbol, 24h.** Competitor sets are stable day-to-day and expensive to compute; this matches the existing cache philosophy and bounds Claude cost. See **P6**.

- **Subject is never its own peer.** The prompt and a server-side filter both exclude the viewed symbol from the returned set. See **P1**.

- **Read-only.** Viewing peers never adds them to the portfolio; only an explicit user action does. See **P9**.

### 1.3 Data flow

1. `PeerMatchmakerCard` mounts on the stock page → `usePeerMatchmaker(symbol)` → `POST /alphaBot/peers { stock_symbol }`.
2. Server reads subject `StockMaster` (sector/industry); on cache miss for peers, runs `PeerAnalysis`, parses strict JSON `{ peers: [...], insight: "..." }`, drops the subject if echoed, dedupes, caps to 3–5, enriches metrics from cache, caches 24h.
3. UI renders the insight + peer rows with metrics; each row has a "Compare" button.
4. On "Compare": client calls `prepare_compare([subject, peer])` (idempotent ingest), writes `selectedSymbols`, navigates to `/main` where the existing flow runs.

---

## 2. Components and Interfaces

### 2.1 Shared types (client) — `client/src/types.ts` additions

```typescript
export interface PeerCompetitor {
  ticker: string;
  company_name: string;
  market_cap: number | null;     // null → render "—", never fake 0
  pe_ratio: number | null;
  debt_to_equity: number | null;
  is_cached: boolean;            // true if metrics came from StockMaster
}

export interface PeerMatchmakerResult {
  subject: string;               // the viewed symbol
  insight: string;               // brief AI comparison blurb (bounded)
  peers: PeerCompetitor[];       // 3–5, excludes subject, deduped
}
```

### 2.2 `usePeerMatchmaker` hook — `client/src/hooks/usePeerMatchmaker.tsx`

```typescript
export interface UsePeerMatchmaker {
  result: PeerMatchmakerResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  compareWithPeer: (peerTicker: string) => Promise<void>; // prepare + navigate
}

export function usePeerMatchmaker(symbol: string): UsePeerMatchmaker;
```

`compareWithPeer` contract: `POST /portfolio/prepare_compare { symbols: [symbol, peerTicker] }` → on success write `localStorage["selectedSymbols"] = [symbol, peerTicker]` → `navigate("/main")`. Toggles `loading` off in `finally`.

### 2.3 Components — `client/src/components/discovery/` (shared with discovery feature)

```typescript
// PeerMatchmakerCard.tsx
interface PeerMatchmakerCardProps {
  symbol: string;
  // subject metrics already on the page, used for side-by-side framing
  subjectMetrics?: { market_cap?: number; pe_ratio?: number; debt_to_equity?: number };
}

// PeerRow.tsx
interface PeerRowProps {
  peer: PeerCompetitor;
  subjectMetrics?: { market_cap?: number; pe_ratio?: number; debt_to_equity?: number };
  onOpen: (ticker: string) => void;     // → /stock/:ticker
  onCompare: (ticker: string) => void;  // → compareWithPeer
  onAdd: (ticker: string) => Promise<void>; // → shared AddToListButton (existing add path)
}
```

`PeerRow` renders each metric with a subtle better/worse indicator relative to the subject **only when both values exist**; otherwise it shows the raw value or "—". It also renders the shared **`AddToListButton`** (defined in feature 02) so a user can add any peer to their portfolio with one click — reusing the exact same add flow as the main table, no parallel logic.

### 2.4 Server — analysis, route, prompt

```python
# server/app/alphaBot/analysis.py  (new subclass)
class PeerAnalysis(StructuredAlphaBotAnalysis):
    prompt_path = PEER_MATCHMAKER_PROMPT

    def build_placeholders(self, stock: StockMaster) -> dict:
        return {
            "symbol":   str(stock.symbol or ""),
            "name":     str(stock.name or ""),
            "sector":   str(stock.sector or ""),
            "industry": str(stock.industry or ""),
        }

    def default_result(self) -> dict:
        return {"peers": [], "insight": "Peer analysis is unavailable right now."}
```

```python
# server/app/alphaBot/blueprint.py  (new route)
@alphaBot_bp.route("/alphaBot/peers", methods=["POST"])
def get_peers():
    symbol = (request.json or {}).get("stock_symbol")
    if not symbol:
        return jsonify({"error": "Stock symbol is required"}), 400

    subject = StockMaster.query.filter_by(symbol=symbol.upper()).first()
    if not subject:
        return jsonify({"error": "Stock not found"}), 404

    cache_key = f"peers:{symbol.upper()}"
    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached), 200

    raw = PeerAnalysis().analyze(subject)              # {"peers": [...], "insight": "..."}
    peers = _enrich_and_filter_peers(raw.get("peers", []), subject.symbol)  # dedup, drop self, cache metrics
    payload = {"subject": subject.symbol, "insight": _bound(raw.get("insight", "")), "peers": peers}

    if peers:
        cache.set(cache_key, payload, timeout=86_400)  # 24h
    return jsonify(payload), 200
```

```python
# server/app/routes/portfolio.py  (new idempotent helper route)
@bp.route("/prepare_compare", methods=["POST"])
def prepare_compare():
    """Ensure each symbol exists in StockMaster so /radar/compare and
    /alphaBot/compare_analysis can run. Idempotent: already-cached symbols are
    no-ops; unknown symbols are ingested via stock_manager. Does NOT add to the
    user's portfolio."""
    symbols = [s.upper() for s in (request.json or {}).get("symbols", [])]
    ingested = ensure_stock_masters(symbols)           # reuse stock_manager ingest
    return jsonify({"prepared": ingested}), 200
```

```markdown
<!-- server/app/prompts/peer_matchmaker.md (sketch) -->
You are AlphaBot's competitive-landscape analyst.

# Subject
{name} ({symbol}) — Sector: {sector}, Industry: {industry}

# Task
Identify 3 to 5 of the subject's most direct publicly-traded competitors. Do NOT include
the subject ({symbol}) itself. Prefer companies in the same industry. Then write one short
insight (<= 2 sentences) contrasting the subject with the strongest alternative.

# Output Format
Return ONLY raw JSON (no fences, no prose):
{
  "insight": "<= 2 sentences",
  "peers": [ { "ticker": "MSFT", "company_name": "Microsoft" } ]
}
```

---

## 3. Data Models

### 3.1 No new SQL tables

Peer sets are cached in Redis (`peers:SYMBOL`, 24h). Peer *metrics* are read from the existing `StockMaster` rows. `prepare_compare` may create new `StockMaster` rows via the existing ingest path (the same rows the rest of the app already uses) — that is not a new model, just reuse.

### 3.2 Metric enrichment rule

`_enrich_and_filter_peers` resolves each peer to `PeerCompetitor`:
- If `StockMaster` has the ticker → fill `market_cap`/`pe_ratio`/`debt_to_equity` from it, `is_cached = true`.
- Else → leave those `null`, `is_cached = false` (UI shows "—"; the row is still openable/comparable, which triggers ingest on demand).

### 3.3 JSON payload shapes

```jsonc
// POST /alphaBot/peers request
{ "stock_symbol": "ORCL" }

// response
{
  "subject": "ORCL",
  "insight": "Oracle trades at a premium to Microsoft on P/E while Microsoft shows stronger free cash flow and lower leverage.",
  "peers": [
    { "ticker": "MSFT", "company_name": "Microsoft", "market_cap": 3100000000000, "pe_ratio": 34.1, "debt_to_equity": 0.3, "is_cached": true },
    { "ticker": "SAP",  "company_name": "SAP SE",    "market_cap": null,         "pe_ratio": null, "debt_to_equity": null, "is_cached": false }
  ]
}
```

---

## 4. Correctness Properties

### P1 — The subject is never its own peer
The viewed symbol can never appear in its own peer list. Both the prompt instructs exclusion and the server filters `subject.symbol` out of the parsed result, case-insensitively.

### P2 — Peer set is deduped and bounded to 3–5
After parsing, peers are deduplicated by ticker and capped to at most 5 (and the UI degrades gracefully if Claude returns fewer than 3). No duplicate tickers and no unbounded list ever reach the client.

### P3 — Metrics are sourced or explicitly absent, never fabricated
A displayed metric is either a real value from `StockMaster` (`is_cached = true`) or `null` rendered as "—". The module never shows `0`/placeholder numbers as though they were real fundamentals, so better/worse indicators only appear when both sides have real data.

### P4 — Malformed AI output degrades gracefully
`PeerAnalysis` inherits the tolerant parser and `default_result()` (`{"peers": [], "insight": …}`). Bad JSON yields an empty peer set and a friendly message, never a 500 or a broken card.

### P5 — Compare routing is self-sufficient (peers are ingested before compare)
Clicking "Compare" guarantees both the subject and the peer exist in `StockMaster` (via idempotent `prepare_compare`) before navigating to the compare tool, so `/radar/compare` and `/alphaBot/compare_analysis` never hit a "NOT FOUND IN CACHE" peer. Already-cached symbols make `prepare_compare` a no-op.

### P6 — Peer lookup is idempotent within TTL
Repeated views of the same symbol within 24h return the cached peer payload instead of re-invoking Claude. Only non-empty results are cached, so a transient failure isn't cached as "no peers."

### P7 — Insight is bounded
The AI insight string is length-bounded server-side (`_bound`), so a verbose response can't produce an oversized card or unbounded payload.

### P8 — Subject identity comes from cache first
Sector/industry used to seed the prompt is read from the existing `StockMaster` row (already populated when the stock was added). A live `OVERVIEW` call is only a fallback when those fields are missing, avoiding redundant external API usage and rate-limit pressure.

### P9 — Module is read-only with respect to portfolio
Rendering peers or opening a peer's page never adds it to the user's portfolio. `prepare_compare` creates shared `StockMaster` cache rows but does **not** create `Stock`/`Portfolio` associations.

---

## 5. Resolved decisions (confirmed)

1. **Compare bridges to the existing `/main` tool** via the `selectedSymbols` localStorage key (no separate comparison surface).
2. **24h cache per subject symbol** for peer sets.
3. **`prepare_compare` ingests peers on demand** rather than pre-warming all competitors.
4. **Components live under `components/discovery/`**, shared with the discovery-engine feature (both are Claude-driven discovery surfaces).
