# Tasks — Deterministic Portfolio Distribution

> (Rn) requirement · (Pn) property. Builds on `score_engine` + `User.budget` (feature 01).

- [ ] 1. Server: allocation engine (pure)
  - [ ] 1.1 Create `server/app/services/allocation_engine.py` — `AllocationItem`/`AllocationPlan` dataclasses, constants (`SCORE_FLOOR`, `LOW_BUDGET_THRESHOLD`, `INDEX_FALLBACK_TICKER`) (R1)
  - [ ] 1.2 Implement `composite_scores(scores, importance)` — weighted blend, equal default, stable order (R1, P7)
  - [ ] 1.3 Implement `allocate(...)` — exclude floor/unpriced (P5, P8), normalize weights (P2), dollars→floor shares (P3), greedy top-up (P4), recompute leftover (P4), index fallback (P6), order-independent (P10)
  - [ ] 1.4 `to_dict()` for plan/items

- [ ] 2. Server: route
  - [ ] 2.1 Add `POST /portfolio/allocation` — budget resolution (body ?? `User.budget`), score via `calculate_compare_scores(is_relative=True)`, run `allocate`, echo budget (R1, R4, P11)
  - [ ] 2.2 Validate positive budget + required symbols/template (R4)

- [ ] 3. Client: types & hook
  - [ ] 3.1 Add `AllocationItem`, `IndexFallback`, `AllocationPlan` to `types.ts`
  - [ ] 3.2 Create `client/src/hooks/useAllocationManager.tsx` — `computeAllocation`, `doughnutData` derived from plan (R4, P9)
  - [ ] 3.3 Add `ALLOCATION` endpoint to `constants/api.ts`

- [ ] 4. Client: wiring & UI
  - [ ] 4.1 Replace AI doughnut source on MainPage with `useAllocationManager.doughnutData` (R4, P9)
  - [ ] 4.2 Create `components/common/AllocationTable.tsx` (symbol/%/$/shares + invested/leftover footer) (R2)
  - [ ] 4.3 Create `IndexFallbackBanner` shown when `plan.index_fallback.recommended` (R3)
  - [ ] 4.4 (Optional) importance weight controls seeded from profile (R1, P7)

- [ ] 5. Tests (math-heavy — high priority)
  - [ ] 5.1 `test_allocation_engine.py` — determinism + order-independence (P1, P10), weights Σ=1 (P2), integer + feasible spend (P3), exact non-negative leftover after top-up (P4), floor/unpriced exclusion (P5, P8), low-budget fallback rules (P6), monotonicity in composite/importance (P7)
  - [ ] 5.2 Frontend `useAllocationManager.test.tsx` — doughnut equals plan weights (P9), budget echo
