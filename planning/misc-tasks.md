# Misc Tasks — Small Fixes & Cross-Cutting Testing

> Catch-all for low-effort fixes that don't warrant a full design, plus the app-wide testing strategy. No deep design docs needed here — each item is small and self-contained. Verify each "fix" against current code before acting (line references drift).

---

## A. Bug fixes / cleanups (small)

- [x] A1. **Radar single-score arg mismatch** — `routes/radar.py` called `calculate_single_stock_scores(stock, template, is_relative)` (3 args) but the function takes 2. Fixed: dropped the unused `is_relative` arg/read so `/radar/single` no longer errors.
- [x] A2. **Duplicate `add_to_master` call** — `routes/stock_data.py` called `add_to_master(symbol)` twice. Fixed: removed the duplicate.
- [x] A3. **`stock_master.global_quote` write** — removed the assignment to the nonexistent `global_quote` column in `routes/stock_data.py`.
- [x] A4. **Debug `testAPI` on mount** — removed the `GET /api/test_db` effect (and now-unused `axios`/`useEffect` imports) from `pages/App.tsx`.
- [ ] A5. **Duplicate enum key** — `constants.py` `AlphaVantageFunction` defines `TIME_SERIES_INTRADAY` twice. Remove the duplicate.
- [ ] A6. **Remove committed artifacts from the repo** — `server/dump.rdb`, `server/app/tempCodeRunnerFile.py`, `client/eslint-report.txt`. Untrack and confirm `.gitignore` coverage. *(Still TODO.)*
- [x] A6b. **Leaked auth debug files** — deleted root `login_response.json` / `token.json` (were untracked, never committed) and added them to `.gitignore`. **ACTION FOR YOU: rotate any real credentials/tokens those files contained** (e.g. invalidate the session token, change the test account password) since they sat on disk.
- [ ] A7. **Stray debug `print()`s** — replace `print(..., flush=True)` debug logging in `routes/`, `services/`, and `alphaBot/` with `current_app.logger` at appropriate levels.
- [ ] A8. **`.env.example` completeness** — ensure every key the app reads (Alpha Vantage, Anthropic, FMP, DB, SECRET_KEY, plus new ones from features 09/10) is documented.

> Add further trivial items here as they're discovered (one checkbox each). Anything that grows beyond a small fix should graduate to its own `planning/` folder.

---

## B. Cross-cutting testing strategy ("tests everywhere")

Goal: a dependable safety net before/while the feature work lands. Backend uses **pytest** (existing `server/tests/`), frontend uses **Vitest + Testing Library** (existing `__tests__/`). Each feature's `tasks.md` already includes its own tests; this section covers **shared infrastructure, coverage targets, and backfill of currently-untested code**.

### B1. Shared test infrastructure
- [ ] B1.1 Backend: review/strengthen `server/tests/conftest.py` fixtures — app factory with a test config, isolated DB (SQLite or transactional rollback per test), a `cache` that no-ops or uses a fake, and an authenticated-client fixture.
- [ ] B1.2 Backend: add a fixture to seed a `User` + `Portfolio` + a couple of `StockMaster` rows for route tests.
- [ ] B1.3 Frontend: confirm `setupTests.ts` mocks (axios, localStorage) and add a shared `renderWithRouter`/context helper.
- [ ] B1.4 Add a factory/helpers module for building `Stock`/`RadarTemplate`/`InvestorProfile` test fixtures (shared across feature tests).

### B2. Coverage targets & policy
- [ ] B2.1 Set coverage targets: **pure logic modules (score_engine, allocation_engine, profile_mapper, parsers) ≥ 90%**; routes/services ≥ 70%; UI hooks ≥ 70%.
- [ ] B2.2 Add coverage reporting (`pytest --cov`, `vitest --coverage`) and fail CI below threshold for the pure-logic modules.
- [ ] B2.3 Adopt the convention: every Correctness Property in a design maps to at least one named test.

### B3. Backfill tests for existing untested code
- [ ] B3.1 `services/alpha_api.py` — URL building, `safe_float`, response parsing (mock httpx).
- [ ] B3.2 `services/stock_manager.py` (`add_to_master`, ingest) — mocked external calls, idempotency.
- [ ] B3.3 `services/news_manager.py` — `process_news_data`, `seed_filters` idempotency (will gain `score_to_label` in feature 04).
- [ ] B3.4 `services/normalization.py` — z-score / min-max edge cases (None, zero std, equal min==max).
- [ ] B3.5 `alphaBot/client.py` — context pruning (`_prune_old_tool_results`), `AlphaBotResult.cacheable` error-prefix detection (mock Anthropic).
- [ ] B3.6 `alphaBot/providers.py` / `payload_stripper.py` — tool result stripping (payload_stripper already has a test; extend).
- [ ] B3.7 Confirm `score_engine.py` tests cover malicious-string sandboxing and clamp-to-[0,100].

### B4. CI
- [ ] B4.1 Add a CI workflow (GitHub Actions) running backend pytest + frontend vitest on PRs.
- [ ] B4.2 Run lint (`eslint`, and a Python linter/formatter) in CI.
- [ ] B4.3 Cache deps for speed; surface coverage in the PR.

### B5. Per-feature test reminder
Each feature folder's `tasks.md` has a "Tests" section mapping to its properties. When implementing a feature, those tests are part of the definition of done — not a follow-up.
