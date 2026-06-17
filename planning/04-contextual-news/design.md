# Design — Contextual News (NEWS_SENTIMENT Integration)

> **Status:** Design (awaiting alignment) · **Owner:** TBD · **Last updated:** 2026-06-13
>
> Scope: make the MainPage news feed reflect the stocks the user actually cares about. Replace the generic category feed with Alpha Vantage `NEWS_SENTIMENT?tickers={...}`, render a Bullish/Bearish **Sentiment Badge** on each headline from the API's score, and refresh the feed whenever the user's selected/added stocks change.
>
> **Reuses:** the existing `Article` type and `NewsSentimentData` type (already models `feed[].overall_sentiment_score/label` and `ticker_sentiment`), `useNewsListManager`, `NewsListItem`, the `List`/`FilterDropdown` UI, and the existing 15-minute news caching philosophy.

---

## 1. Architecture

### 1.1 Where this fits

Today `/data/news` takes a category `filter`, calls `get_news_data(filter)`, persists results to `GeneralStockNews` keyed by `filter_id` with a 15-minute freshness check, and `useNewsListManager` renders them. The `NewsSentimentData` TS interface **already** describes the richer payload (per-article `overall_sentiment_score`/`overall_sentiment_label`, and per-ticker `ticker_sentiment`). So this feature is mostly: a **ticker-aware endpoint**, a **sentiment-badge mapping**, and **wiring the feed to the selection state** that already lives in `useCompareAlphaBotManager` (`selectedSymbols`).

```
┌──────────────────────── CLIENT (React) ────────────────────────┐
│  MainPage                                                       │
│    selectedSymbols (existing)  +  stocks (existing)             │
│      │                                                          │
│   useNewsListManager  (extended)                                │
│     mode: "portfolio" | "category"                              │
│     contextTickers = selected ?? all-portfolio                  │
│      │ POST /data/contextual_news { tickers }   (mode=portfolio)│
│      │ POST /data/news            { filter }     (mode=category)│
│   <List> → <NewsListItem article + <SentimentBadge/> />         │
└──────┼─────────────────────────────────────────────────────-──┘
       ▼
┌──────────────────────── SERVER (Flask) ─────────────────────────┐
│  data_bp                                                         │
│   └─ POST /data/contextual_news { tickers: [...] }              │
│         tickers empty → 200 {fallback: "category"}  (P1)        │
│         key = newsctx:{sorted_tickers}                          │
│         cache hit (15m)? → return                               │
│         raw = NEWS_SENTIMENT(tickers=",".join(tickers))         │
│         items = ContextualNews.transform(raw, tickers)          │
│         cache.set(key, items, 900)                              │
│                                                                  │
│  services/news_manager.py  (additions)                          │
│     transform_sentiment_feed(raw, tickers) -> list[dict]        │
│     score_to_label(score) -> "Bullish"|"Bearish"|"Neutral"|…    │
└──────────────────────────────────────────────────────────────--┘
```

### 1.2 Key architectural decisions

- **Two modes, one feed: `portfolio` (ticker-contextual) and `category` (the existing generic feed).** When the user has stocks, the feed defaults to `portfolio` mode scoped to selected tickers (or all portfolio tickers if nothing is explicitly selected). With an empty portfolio it falls back to the existing category feed. This keeps the old behavior alive and avoids a dead empty state. See **P1**.

- **Contextual news is cached in Redis keyed by the sorted ticker set, not persisted to `GeneralStockNews`.** Ticker combinations are effectively unbounded, so a DB table keyed by combo would bloat. The existing `GeneralStockNews`/`Filter` tables stay for category mode only. See **P4**.

- **The Sentiment Badge is a pure function of the API's score.** `score_to_label` uses Alpha Vantage's documented thresholds. A missing/unparseable score maps to **Neutral**, never to a fabricated Bull/Bear call. See **P2**, **P5**.

- **Feed refresh is driven by the existing selection state.** The feed re-fetches when `contextTickers` changes (a stock is added or the selection set changes), with coalescing so rapid toggles don't spam the API. See **P3**, **P6**.

- **Per-article ticker relevance is preserved.** When `tickers` are provided, AV returns `ticker_sentiment` per article; we surface the relevance and the per-subject sentiment so the badge reflects the *selected ticker's* sentiment, not just the article's global tone, when available. See **P7**.

### 1.3 Data flow

1. MainPage computes `contextTickers = selectedSymbols.size ? [...selected] : stocks.map(s => s.symbol)`.
2. `useNewsListManager` in `portfolio` mode `POST`s `/data/contextual_news { tickers }`.
3. Server checks the sorted-ticker cache; on miss calls `NEWS_SENTIMENT`, transforms each feed item into a `ContextualArticle` (article fields + sentiment label/score + per-ticker relevance), caches 15 min.
4. `NewsListItem` renders the headline plus a `SentimentBadge`. Selecting/adding a stock changes `contextTickers` → effect re-fetches (coalesced).

---

## 2. Components and Interfaces

### 2.1 Shared types (client) — `client/src/types.ts` additions

```typescript
export type SentimentLabel =
  | "Bearish" | "Somewhat-Bearish" | "Neutral" | "Somewhat-Bullish" | "Bullish";

export interface ContextualArticle extends Article {
  overall_sentiment_score: number | null;
  overall_sentiment_label: SentimentLabel;     // "Neutral" when score is null
  // sentiment for the specific selected ticker this article was matched on, if any
  subject_ticker?: string;
  subject_sentiment_score?: number | null;
  relevance_score?: number | null;             // for sorting
}

export type NewsMode = "portfolio" | "category";
```

### 2.2 `useNewsListManager` — extended (`client/src/hooks/useNewsListManager.tsx`)

```typescript
export interface UseNewsListManager {
  mode: NewsMode;
  setMode: (m: NewsMode) => void;

  // category mode (existing)
  newsFilter: string;
  handleFilterChange: (filter: string) => Promise<void>;

  // portfolio (contextual) mode (new)
  contextTickers: string[];
  fetchContextualNews: (tickers: string[]) => Promise<void>;

  articles: ContextualArticle[];
  loading: boolean;
  error: string | null;
}

// MainPage usage: an effect calls fetchContextualNews(contextTickers) when the
// memoized contextTickers array changes; the hook coalesces rapid calls and falls
// back to category mode when tickers is empty.
```

### 2.3 Components

```typescript
// client/src/components/common/SentimentBadge.tsx
interface SentimentBadgeProps {
  label: SentimentLabel;
  score?: number | null;          // optional tooltip detail
  size?: "sm" | "md";
}
// Color map: Bullish/Somewhat-Bullish → green tones, Bearish/Somewhat-Bearish →
// red tones, Neutral → muted gray. Renders nothing distracting for Neutral.

// client/src/components/common/NewsListItem.tsx  (extended)
interface NewsListItemProps {
  article: ContextualArticle;     // was Article
  // renders <SentimentBadge/> next to the headline when in portfolio mode
}
```

### 2.4 Server — route + service additions

```python
# server/app/routes/stock_data.py  (new route)
@bp.route("/contextual_news", methods=["POST"])
@login_required
def contextual_news():
    tickers = _norm_tickers((request.json or {}).get("tickers", []))   # upper, dedupe, cap
    if not tickers:
        # No context → tell client to use the existing category feed
        return jsonify({"fallback": "category", "articles": []}), 200

    cache_key = f"newsctx:{'_'.join(sorted(tickers))}"
    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached), 200

    raw = get_av_json(AlphaVantageFunction.NEWS_SENTIMENT, tickers=",".join(tickers))
    if not raw or "feed" not in raw:
        if "Information" in (raw or {}) or "Note" in (raw or {}):
            return jsonify({"error": "API rate limit exceeded. Try again later."}), 429
        return jsonify({"articles": []}), 200

    articles = transform_sentiment_feed(raw, tickers)   # list[ContextualArticle dict]
    payload = {"articles": articles}
    cache.set(cache_key, payload, timeout=900)          # 15 min
    return jsonify(payload), 200
```

```python
# server/app/services/news_manager.py  (additions)

# Alpha Vantage documented thresholds
def score_to_label(score: float | None) -> str:
    if score is None:
        return "Neutral"
    if score <= -0.35: return "Bearish"
    if score <= -0.15: return "Somewhat-Bearish"
    if score <   0.15: return "Neutral"
    if score <   0.35: return "Somewhat-Bullish"
    return "Bullish"

def transform_sentiment_feed(raw: dict, tickers: list[str]) -> list[dict]:
    """
    Map each NEWS_SENTIMENT feed item to a ContextualArticle dict:
      - base article fields (title, url→link, summary, source→news_company, banner→image_link, time)
      - overall_sentiment_score / label (label via score_to_label, never trusting blank)
      - the matched subject ticker's per-ticker sentiment + relevance (if the article
        references one of `tickers`)
    Dedupe by url, drop placeholder titles ("Before you continue"), sort by relevance desc.
    """
    ...
```

---

## 3. Data Models

### 3.1 No new SQL tables

Contextual news is cached in Redis (`newsctx:{sorted_tickers}`, 15-min TTL). The existing `GeneralStockNews`/`Filter` tables remain the store for **category** mode only. This avoids an unbounded combo-keyed table.

### 3.2 JSON payload shapes

```jsonc
// POST /data/contextual_news request
{ "tickers": ["AAPL", "MSFT"] }

// response (portfolio mode)
{
  "articles": [
    {
      "title": "Apple unveils …", "link": "https://…", "summary": "…",
      "news_company": "Reuters", "image_link": "https://…", "time_published": "20260613T120000",
      "overall_sentiment_score": 0.41, "overall_sentiment_label": "Bullish",
      "subject_ticker": "AAPL", "subject_sentiment_score": 0.38, "relevance_score": 0.92
    }
  ]
}

// response (empty context → client switches to category feed)
{ "fallback": "category", "articles": [] }
```

---

## 4. Correctness Properties

### P1 — Empty context never produces a dead feed
When there are no selected tickers and an empty portfolio, the feed transparently falls back to the existing category news (`/data/news`). The user always sees news; they never get a blank "no portfolio" panel.

### P2 — The badge is a pure, total function of the score
`score_to_label` maps every possible numeric score to exactly one label using Alpha Vantage's documented thresholds, and maps `None`/unparseable to `Neutral`. Same score → same label, always; there is no path that produces an undefined badge.

### P3 — Feed reflects the current selection
Adding a stock or changing the selected set updates `contextTickers`, which triggers a re-fetch, so the feed always corresponds to what the user currently has selected/holds. Stale articles from a previous selection are replaced, not merged.

### P4 — Ticker-set cache key is order-independent and bounded
The cache key sorts and caps the ticker list, so `[AAPL, MSFT]` and `[MSFT, AAPL]` hit the same entry, and a pathologically large selection can't create an enormous key or request. Category-mode storage is unaffected.

### P5 — A badge is never shown for absent sentiment
If an article has no usable sentiment score, it renders the muted `Neutral` badge (or no badge), never a green "Bullish"/red "Bearish" call inferred from nothing. The UI never implies confidence the API didn't provide.

### P6 — Refreshes are coalesced
Rapid selection toggles collapse into a single in-flight request (latest wins); the hook cancels/ignores superseded responses so the rendered feed always matches the most recent `contextTickers`, and the API isn't hammered.

### P7 — Badge prefers subject-ticker sentiment when available
When the article carries `ticker_sentiment` for one of the selected tickers, the badge reflects *that* ticker's sentiment (and the article is sortable by its relevance), falling back to the article's overall sentiment only when no per-ticker match exists.

### P8 — Articles are deduped and clean
Results are deduplicated by URL and placeholder/junk titles are filtered, so the same story can't appear twice when multiple selected tickers reference it.

### P9 — Rate-limit failures are explicit, not silent
When Alpha Vantage returns an `Information`/`Note` rate-limit payload, the endpoint returns `429` and the UI surfaces a clear "try again later" state rather than rendering an empty feed that looks like "no news."

---

## 5. Resolved decisions (confirmed)

1. **Portfolio mode scopes to selected tickers, falling back to all portfolio tickers, then to category mode.**
2. **Redis cache keyed by sorted ticker set (15-min TTL); no new DB table.**
3. **Badge thresholds follow Alpha Vantage's documented sentiment bands.**
4. **Category mode is retained** as the fallback and remains available via the existing filter dropdown.
