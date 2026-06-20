# Tasks — Contextual News

> (Rn) requirement · (Pn) property. Reuses `Article`/`NewsSentimentData` types, `useNewsListManager`, `NewsListItem`.

- [ ] 1. Server: route + transform
  - [ ] 1.1 Add `NEWS_SENTIMENT` already in `constants.py` (verify) and `_norm_tickers()` helper (upper/dedupe/cap) (R1)
  - [ ] 1.2 Add `POST /data/contextual_news` to `routes/stock_data.py` — empty→fallback, sorted-ticker cache key, 429 passthrough (R1, R4, P4, P9)
  - [ ] 1.3 Add `score_to_label(score)` to `news_manager.py` (AV thresholds; None→Neutral) (R2, P2, P5)
  - [ ] 1.4 Add `transform_sentiment_feed(raw, tickers)` — base fields + sentiment + per-ticker match, dedupe by URL, sort by relevance (R1, R2, P7, P8)

- [ ] 2. Client: types & hook
  - [ ] 2.1 Add `ContextualArticle`, `SentimentLabel`, `NewsMode` to `types.ts` (R1, R2)
  - [ ] 2.2 Extend `useNewsListManager` with `mode`, `contextTickers`, `fetchContextualNews`, coalescing + stale-guard (R1, R3, P6)
  - [ ] 2.3 Add `CONTEXTUAL_NEWS` endpoint to `constants/api.ts`

- [ ] 3. Client: components & wiring
  - [ ] 3.1 Create `components/common/SentimentBadge.tsx` (color map; muted Neutral) (R2, P5)
  - [ ] 3.2 Extend `NewsListItem` to render `SentimentBadge` in portfolio mode (R2)
  - [ ] 3.3 In `MainPage`, compute memoized `contextTickers` (selected ?? portfolio) and effect to refetch on change (R3, P3)
  - [ ] 3.4 Keep the category filter dropdown available as the fallback mode (R1, P1)

- [ ] 4. Tests
  - [ ] 4.1 Backend `test_news.py` additions — `score_to_label` thresholds incl. None→Neutral (P2, P5), empty tickers→fallback (P1), sorted cache key (P4), 429 passthrough (P9), dedupe (P8)
  - [ ] 4.2 Frontend `useNewsListManager.test.tsx` — refetch on ticker change (P3), coalescing/stale-guard (P6), badge prefers subject sentiment (P7)
