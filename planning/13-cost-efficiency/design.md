# Design — API and LLM cost

> **Status:** Notes, not scheduled. Do this after the deterministic doughnut (feature 07). · **Last updated:** 2026-11-03
>
> Scope: stop paying Sonnet and Alpha Vantage for work the database already has, or that nobody asked for twice. Ranked list is in §3. Decisions already made are in §2.

Rough unit costs below use Claude Sonnet 4.5 list rates (about $3 / million input tokens, $15 / million output). They are order-of-magnitude, so the ranking stays honest when prices move. Alpha Vantage and Financial Modeling Prep are mostly a plan-tier problem: too many calls forces a more expensive subscription, even when each call has no line item.

---

## 1. What is true in the code today

### 1.1 The quota does not cover the calls the UI makes

`alphabot_rate_limit` (3/day on the free tier, unlimited on `dev`) is only on the blocking routes in `server/app/alphaBot/blueprint.py`: in-depth, compare, user query, event pulse. The client calls the `/stream` variants, plus `POST /discovery/generate`. Those are login-only. Background moat and news scoring is not counted either.

### 1.2 `add_to_master` is not "missing or expired" on every path

`server/app/services/stock_manager.py` `add_to_master` always does six Alpha Vantage calls (overview, global quote, news with `limit=30`, insider transactions, balance sheet, cash flow) and then always queues two Sonnet calls (`get_ai_analysis_metrics`: news score, then moat score).

| Caller | When it runs |
|---|---|
| `add_stock` (watchlist add) | Row missing, or `last_stock_update` older than 7 days |
| Brokerage sync (`_ensure_symbol_ingested`) | Same 7-day check (`STOCK_STALE_DAYS`) |
| `POST /data/stock_data`, `POST /portfolio/stocks` | Row missing, or `market_cap` is null |
| `POST /portfolio/refresh` | Every symbol, every click. No age check |

Opening a symbol that already has a market cap does not re-ingest. It refreshes `GLOBAL_QUOTE` when `last_stock_update` is older than 15 minutes, and that write sets `last_stock_update` to now (`server/app/routes/stock_data.py`). A symbol anyone looks at never ages past 7 days, so the watchlist-add and brokerage checks skip ingest. Fundamentals, insider data, the news blob, and both AI scores stay frozen until refresh.

`market_cap is None` is a second hole. ETFs and any symbol whose overview came back empty take the full ingest on every stock-page open and every watchlist load.

`last_fundamental_update` already exists on `StockMaster` and is not what these guards read. The 15-minute quote job and the 7-day fundamentals job share one timestamp, and the quote job wins.

`POST /portfolio/refresh` also has `@cache.memoize(timeout=900)` on a function with no arguments. That is a 15-minute blanket on the route, not a per-symbol expiration.

### 1.3 Scores already overwrite. Summaries are already stored. There is no history

`StockMaster` columns, written by `get_ai_analysis_metrics`:

- `ai_news_score`, `ai_news_summary`
- `ai_moat_score`, `ai_moat_summary`

The summary is the two-to-three sentence write-up. The next run replaces the number and the text. No history table.

`news_sentiment_data` is one JSON blob of the latest Alpha Vantage news payload, replaced wholesale. It is "news as of the last ingest," not a dated archive. It cannot answer "what happened between these two old dates."

### 1.4 The agent paths re-fetch data the app already paid for

- In-depth (`in_depth.md`) tells the model it must call overview, earnings, cash flow, and news. Both the blocking and the stream routes pass `include_tools=False`. The stock page auto-starts the stream on every symbol (`useStockAnalysisManager`). The report is a Sonnet essay from memory. Cache key `in_depth_analysis:{SYMBOL}`, TTL 15 minutes.
- Event pulse (`event_pulse.md`) requires a time series, news inside the window, and peer tickers. Stream route uses tools. Loop cap is 50 turns, `max_tokens=8192`, and `tools/list` runs on every request (`server/app/alphaBot/client.py`). Cache key includes the end timestamp and swing type, TTL 1 hour, process-local.
- User chat uses tools, is not cached, and does not send prior turns. Each question can re-fetch overview and news.
- Discovery (`super_prompt.md`) uses tools, capped at 8 names. Cache key is profile signature plus refinements, TTL 15 minutes. Empty or failed parses are not cached, so a bad response is paid for again. Each new refinement is a new key.
- Compare is the cheap AI path: no tools, news blob and statement history stripped, cache 15 minutes. Leave it alone except for a possible smaller model later.

### 1.5 Cache and duplicate vendors

Production gunicorn is 3 workers (`deploy/docker-compose.prod.yml`). The cache is `SimpleCache` in `server/app/__init__.py` (500 entries, process memory). Workers do not share it, and a restart drops it. `get_av_json` memoizes for 15 minutes, including Alpha Vantage error bodies (`Note` / `Information`), so a rate-limit response can sit there as if it were data.

Every stock page also calls Financial Modeling Prep three times (`cash-flow-statement`, `balance-sheet-statement`, `key-metrics`) via `get_in_depth_financials`. Balance sheet and cash flow are already on the row from Alpha Vantage. The fields that call uniquely fills are ROIC and price-to-free-cash-flow.

Chart `1D` and `1W` both request full 5-minute intraday and then drop most of the bars. Alpha Vantage bills per request, so this is cache pressure more than a bigger invoice. `1D` and `1W` do share one memoize key.

General-news on MainPage is in decent shape: `GeneralStockNews` plus a 15-minute freshness check.

---

## 2. Decisions

1. **Manual refresh goes away.** It is a dev control. Users should not have to press it. Remove `POST /portfolio/refresh` and the button when the staleness check below exists.
2. **One age for the whole row is the wrong question.** Long-term investors still need today's price and today's news. They do not need today's balance sheet. Use three clocks, per symbol, and refresh only the stale slice. Do not refresh the whole watchlist because one name is stale, and do not re-ingest a fresh row on every page view.
   - **Price:** already 15 minutes (`GLOBAL_QUOTE`). Leave it.
   - **News and the news score:** daily. A week-old "no material news" is wrong the morning after earnings, including for someone who holds for years. Skip the score when the article set is unchanged, so most days the cost is one news call and no model call.
   - **Statements, overview fundamentals, insider, moat:** 7 days is plenty, and quarterly would still be honest. Filings land quarterly. Margins, ROE, free cash flow, and the moat write-up do not move because a day passed. Insider filings are lumpy. Weekly catches them without a daily statement pull.
3. **Price-based ratios are not a reason to refetch overview daily.** `pe_ratio`, market cap, price-to-sales, price-to-book, and dividend yield are stored from the last overview payload while `price` updates every 15 minutes, so those displayed ratios lag the price. Recompute them from the live price and the stored fundamentals (earnings, shares, sales, book, dividend). A daily overview call is an expensive way to multiply price by a number that did not change.
4. **The slow clock reads `last_fundamental_update`, not `last_stock_update`.** Quote refresh may keep writing `last_stock_update` every 15 minutes. If the staleness check uses that column, the weekly job never fires for any symbol people look at. Set `last_fundamental_update` only when overview, statements, and insider have actually been refreshed. News gets its own timestamp.
5. **Moat and news scores overwrite in place.** Keep the summary columns. Do not add a history of scores or write-ups.
6. **Store news articles. Store event-pulse prose only for a coarse, shared swing.** Headline rows are small and reusable across users. An exact `(symbol, start timestamp, end timestamp)` AI cache is not. See features 6 and 7.

---

## 3. Ranked work

Rank is the order to do them, weighing savings against importance. "Price" is how much spend that item cuts once the app has real traffic. "Importance" is whether it is also a correctness or safety fix, and whether it pays off before there are many users. A high price score that only appears at scale is ranked behind a smaller fix that stops a bug or an unbounded bill now.

| Rank | Feature | Price | Importance | Why this rank |
|---|---|---|---|---|
| 1 | Split the freshness clocks and drop manual refresh | High | High | Stops both failure modes: scores frozen forever, and a full 6-call plus 2-Sonnet ingest on every symbol whenever refresh is hit. The ETF `market_cap is None` hole is part of this. Pays off with one user. |
| 2 | Cap the routes the UI actually calls | High | High | Stream in-depth, chat, event pulse, and discovery ignore the 3/day limit. A 50-turn tool loop is the unbounded bill. This is a safety rail, not a refactor. |
| 3 | Rescore only when the input changed. Smaller model. Thin news payload | High | High | Every ingest currently spends two Sonnet calls. The news prompt pastes the raw feed, including per-ticker sentiment arrays: often the single fattest prompt in the app, for a 2-sentence JSON result. Moat input is already small. |
| 4 | One shared cache. Do not cache vendor errors | High as a multiplier | High | 3 workers × `SimpleCache` means every TTL in this doc is a suggestion. Caching `Note` bodies turns a rate limit into a 15-minute outage of fake data. |
| 5 | Ground event pulse in data we fetch. One call. No news tool | High | High | The first request is the expensive one. A tool loop that re-fetches price (already on the chart) and news (should be ours) dominates storage savings. One sector ETF or a fixed peer replaces "the model picks AMD and AVGO." |
| 6 | News archive, article grain, fetch the missing slice | High once pulse and scores share it | High | Right shape for reuse across users, the news score, the stock page, and event pulse. Space is cheap next to one Sonnet loop. Do this with feature 5, not instead of it. |
| 7 | In-depth reads `StockMaster` and does not ask for tools | Medium | High | Auto-fires on every symbol visit. Cost per hit is one essay (cents, if cached), but today the essay is ungrounded. Quality fix first, cost fix second. |
| 8 | Trim Financial Modeling Prep to the fields Alpha Vantage lacks | Medium | Medium | Three calls per stock page, two of them duplicate. Matters when FMP is the plan that runs out. |
| 9 | Store one event-pulse write-up per detected swing | Medium at scale, low before that | Medium | Worth it only after the window is a stable swing id with a multi-day TTL. Exact timestamps will not collide. More users help AAPL's last earnings gap, not a random name and a random fortnight. |
| 10 | Discovery without a tool tour | Medium | Medium | Verifying eight tickers with tools, once per refinement, on a 15-minute cache, adds up when people iterate. A no-tools (or one-lookup) pass plus caching empty failures is enough until discovery quality actually needs live fundamentals. |
| 11 | Chat gets the stored snapshot and a short tool allowlist | Medium | Low until chat is used | Each question is already stateless, which keeps history from growing. It still re-fetches. Do this after the snapshot and the news archive exist so the prompt has something to hold. |
| 12 | Memoize symbol search | Low | Low | 300ms debounce and a 2-character minimum are already there. `SYMBOL_SEARCH` is a cheap endpoint. Server-side memoize is polish. |
| 13 | Smaller chart requests for `1D` | Low | Low | Same Alpha Vantage request count. Shrinks what sits in the 500-entry cache. |

Compare stays where it is. It is already a single no-tools call on stripped metrics.

---

## 4. Feature notes

### 4.1 Freshness clocks (rank 1)

On watchlist load, brokerage sync, and stock-page open, refresh only the slice that is stale:

- Price: one `GLOBAL_QUOTE` when `last_stock_update` is older than 15 minutes. This may keep updating `last_stock_update`. Recompute price-based ratios (P/E, market cap, price-to-sales, price-to-book, dividend yield) from this price and the stored fundamentals instead of refetching overview to make them match.
- News: one `NEWS_SENTIMENT` when the news timestamp is older than a day. Rescore only when the article set changed.
- Fundamentals: overview, statements, insider, and (only if those inputs changed) the moat score, when `last_fundamental_update` is null or older than 7 days. This is the only writer of `last_fundamental_update`. Quarterly would still be accurate for filings. Weekly is the compromise that also picks up insider filings.
- A null `market_cap` is not a reason to ingest on every request. ETFs often have no market cap. Treat "we already tried and overview was empty" as a successful fundamental refresh with sparse fields.

A daily full ingest (all six Alpha Vantage calls plus both scores) is about seven times the weekly bill and mostly re-downloads a balance sheet that changes quarterly. Daily is the right cadence for news only.

Remove the refresh button and `POST /portfolio/refresh` in the same change. Until that ships, leaving the button in place means one click still bypasses these clocks.

### 4.2 Meter the live routes and cap turns (rank 2)

Put the same daily limit on:

- `/alphaBot/in_depth_analysis/stream`
- `/alphaBot/compare_analysis/stream`
- `/alphaBot/user_query/stream`
- `/alphaBot/event_pulse/stream`
- `/discovery/generate`

Count a call when it misses cache and actually invokes the model. A cache hit should not burn a daily use. Background moat and news scoring stays off the user quota. It is our ingest cost, controlled by rank 3.

Drop the tool-loop ceiling from 50 to a small number (3 or 4 turns) on every path that still has tools. Cache `tools/list` for the life of the process at least. Send an allowlist, not the full Alpha Vantage catalog, on each turn. The catalog is input tokens repeated on every turn.

### 4.3 Scores (rank 3)

Keep overwriting `ai_*_score` and `ai_*_summary`. Skip the call when the input is unchanged:

- News score: skip when the article set (or a hash of it) matches the set that produced the current summary.
- Moat score: skip when description, margins, ROE, free cash flow, and market cap match what produced the current summary. A monthly ceiling is enough even if those move a little. A moat write-up does not need to track a 15-minute quote.

Use a small model for both. The output is a fixed JSON object. Send the news model titles, summaries, and one sentiment figure per article. Do not send `ticker_sentiment` arrays or the raw payload.

### 4.4 Shared cache (rank 4)

Redis (the README already describes this; the app does not use it). One cache across the 3 gunicorn workers. Do not store Alpha Vantage bodies that contain `Note` or `Information`. A failed fetch should fall through to stale rows, the way `/data/news` already does.

### 4.5 Event pulse, first request (rank 5)

The price window is already in the chart response. News for that window should come from the archive (rank 6). The call is one shot, no tools: classification, two sentences, peer context, confidence. The prompt already asks for compact series and forbids a preamble. Hold it to that.

Peer check is the remaining multiplier. Use one liquid reference (a sector ETF, or one fixed peer), fetched by us, not chosen and fetched by the model.

If the vendor has no headlines for that range, say so in the prompt and let the classification come back as market noise. Do not spend turns hunting.

### 4.6 News archive (rank 6)

Article rows, not one blob per symbol. Key by symbol plus a stable article id (URL or the vendor id). Columns worth keeping: `published_at`, title, summary, source, sentiment score, sentiment label. A window is `published_at` between the selection endpoints.

Fetch only the gap. Overlapping selections dedupe. The latest-feed blob on `StockMaster` can go away once the table is the source for the news score and the stock-page sentiment counts.

This does not make old chart selections free on day one. A range is local only after someone has fetched it, and the vendor may not return news that old at all. The multi-user win is the second person to open a range we have, on any worker, without caring whether their endpoints match.

Database size is not the constraint. A few years of headlines for the symbols we track is small beside one tool-using Sonnet call. Do not keep raw vendor payloads "just in case."

### 4.7 In-depth (rank 7)

Put the stored metrics, the moat summary, and the news summary in the prompt. Delete the tool instructions from `in_depth.md`. Cache key can stay `in_depth_analysis:{SYMBOL}` with a TTL of hours, not 15 minutes, invalidated when `last_fundamental_update` changes. Still auto-running it on every visit is fine once it is one grounded call and a shared cache hit.

### 4.8 Financial Modeling Prep (rank 8)

Stop calling cash flow and balance sheet there. If ROIC and price-to-free-cash-flow are worth keeping, call `key-metrics` only, on the same 7-day fundamental clock, and store the two numbers. If they are not worth a second vendor, drop Financial Modeling Prep until they are.

### 4.9 Stored event-pulse write-ups (rank 9)

Do this after swing detection is a product behavior, not as a way to force cache hits.

- One row per `(symbol, swing)`. Overwrite on regenerate. No history. Same rule as the scores.
- TTL is days or weeks for a finished move. A move that ended yesterday can refresh for a few days while headlines are still landing, then freeze.
- The key is the detected swing's start and end, not the raw click timestamps, and not rally-vs-selloff as a separate entry for the same leg.

Snapping a freehand drag onto a local leg is reasonable because the question is "why did this move happen." Show the snapped window. Silently analyzing a different span, then storing it, caches the wrong story. Coarse bars or a minimum move size are what create reuse. A detector whose job is to raise the odds of a key collision will still fragment, and it will be wrong on some legs.

More users raise the hit rate for famous moves on famous symbols. They do not raise it for the long tail. Do not justify this table with "storage gets efficient as the user count grows" without that caveat. Feature 6 gets that benefit earlier and on more requests, because headlines overlap even when the swings do not.

### 4.10 The small items (ranks 10–13)

- Discovery: prefer a single no-tools call. If tools stay, allow one verification lookup and cache failures for a short TTL so a parse miss does not rerun immediately.
- Chat: include the stored snapshot and archived headlines. Allow a tool only when the snapshot does not contain the answer.
- Search: memoize `q` for a few minutes in the shared cache.
- Charts: request a compact 5-minute series for `1D`. Keep the shared full series only if the user actually opens `1W`.

---

## 5. What not to do

- Do not keep a history of moat scores, news scores, or event-pulse essays.
- Do not use `last_stock_update` as the 7-day clock.
- Do not let a null `market_cap` mean "ingest on every request."
- Do not store event-pulse prose under the exact timestamps the user clicked.
- Do not snap selections only to manufacture collisions, and do not hide the window you actually analyzed.
- Do not expect an archive of recently fetched news to cover a multi-year chart selection the vendor never returned.
