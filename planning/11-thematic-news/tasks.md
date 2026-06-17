# Tasks — Thematic Global-News Discovery Cards

> (Rn) requirement · (Pn) property. Lives on the Discovery page (feature 02); reuses `AddToListButton`. Confirm scheduling mechanism before §4.

- [ ] 1. Models & migration
  - [ ] 1.1 Add `NewsTheme` (week_key, title, summary, rank, is_active) + `ThemeStock` (theme_id, symbol, rationale, rank) (R1)
  - [ ] 1.2 Alembic migration

- [ ] 2. Generation service
  - [ ] 2.1 Create `server/app/services/thematic_news.py` — `current_week_key()` (fixed tz ISO week) (R2, P8)
  - [ ] 2.2 `ThemeParser.parse(text)` — strict, ≤6 themes, ≤5 deduped valid tickers, bounded rationale/summary, `[]` on failure (R1, P5, P6)
  - [ ] 2.3 `generate_weekly_themes(force=False)` — per-week idempotency, single-flight lock, run Claude (tools), atomic swap (keep last-good on failure) (R3, P2, P3, P4, P7)
  - [ ] 2.4 Create `server/app/prompts/thematic_news.md` + add `THEMATIC_PROMPT` to `constants.py` (R1)

- [ ] 3. Route
  - [ ] 3.1 Add `GET /discovery/themes` (DB read, current week, fallback to most-recent active) (R2, P1, P10)

- [ ] 4. Scheduling
  - [ ] 4.1 DECISION: APScheduler in-process vs external cron → `flask thematic-news generate` (confirm with deploy model)
  - [ ] 4.2 Implement chosen trigger calling `generate_weekly_themes()` weekly (R1, R3)

- [ ] 5. Client
  - [ ] 5.1 Add `ThemeStock`, `NewsTheme`, `ThematicNewsResponse` types
  - [ ] 5.2 Create `client/src/hooks/useThematicNews.tsx` (fetch + `addToList`) (R1, R4)
  - [ ] 5.3 Create `components/discovery/ThematicNewsSection.tsx`, `ThemeCard.tsx`, `ThemeStockRow.tsx` (with `AddToListButton`) (R1, R4)
  - [ ] 5.4 Mount the section on `DiscoveryPage`; add `THEMES` endpoint to `constants/api.ts`

- [ ] 6. Tests
  - [ ] 6.1 Backend `test_thematic_news.py` — `current_week_key` determinism (P8), parser bounds/dedup/`[]`-on-failure (P5, P6), idempotent per week (P2), failure keeps last-good (P3), atomic activation (P4), serving is DB-only (P1)
  - [ ] 6.2 Frontend `useThematicNews.test.tsx` — render themes, empty state (P10), add via shared button (P9)
