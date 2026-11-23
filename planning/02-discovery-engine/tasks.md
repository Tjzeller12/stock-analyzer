# Tasks — Discovery Engine

> (Rn) requirement · (Pn) property. Depends on feature 01 (`build_profile_context`, `profile_signature` inputs).

- [x] 1. Server: discovery service
  - [x] 1.1 Create `server/app/services/discovery.py` with `Recommendation` dataclass, `MAX_REFINEMENTS`, `MAX_RECOMMENDATIONS` (R1)
  - [x] 1.2 Implement `SuperPrompt.build(profile_ctx, refinements)` — generic fallback when ctx empty (R1, P1)
  - [x] 1.3 Implement `DiscoveryParser.parse(text)` — fence strip, validate, dedupe, cap, bound rationale, `[]` on failure (R1, P2, P10)
  - [x] 1.4 Implement `profile_signature(user)` for cache stability (R4, P7)
  - [x] 1.5 Implement `_sanitize_refinements()` — strip + cap (R3, P5)

- [x] 2. Server: prompt + route
  - [x] 2.1 Create `server/app/prompts/super_prompt.md` per design sketch + add `SUPER_PROMPT` to `constants.py` (R1)
  - [x] 2.2 Create `server/app/routes/discovery.py` blueprint with `POST /discovery/generate` (cache → build → run → parse → cache) (R1, R4)
  - [x] 2.3 Register blueprint in app factory

- [x] 3. Client: types & hook
  - [x] 3.1 Add `DiscoveryRecommendation`, `DiscoverySession`, `DiscoveryResponse` to `types.ts` (R1)
  - [x] 3.2 Create `client/src/hooks/useDiscoveryManager.tsx` — generate/refine/clear, loading in `finally`, refinement cap (R1, R3, P8)
  - [x] 3.3 Wire `addToPortfolio` to existing `PORTFOLIO_ENDPOINTS.ADD` (R2, P12)
  - [x] 3.4 Add `DISCOVERY_ENDPOINTS` to `constants/api.ts`

- [x] 4. Client: shared add primitive
  - [x] 4.1 Create `client/src/components/common/AddToListButton.tsx` (idle/adding/added states) reusing `addStock` (R2, P12)

- [x] 5. Client: page + components
  - [x] 5.1 Create `client/src/pages/DiscoveryPage.tsx` (mount → generate; empty-profile CTA → onboarding) (R2, P1)
  - [x] 5.2 Create `components/discovery/DiscoveryCard.tsx` (with `AddToListButton`) (R2)
  - [x] 5.3 Create `components/discovery/DiscoveryGrid.tsx` (skeleton variant) (R2, P8)
  - [x] 5.4 Create `components/discovery/RefineSearchBar.tsx` (chips, clear) (R3)
  - [x] 5.5 Add protected `/discovery` route in `App.tsx` + nav entry

- [x] 6. Tests
  - [x] 6.1 Backend `test_discovery.py` — parser strictness/dedup/cap/`[]`-on-failure (P2), generic fallback prompt (P1), cache idempotency (P7), refinement cap (P5)
  - [x] 6.2 Frontend `useDiscoveryManager.test.tsx` — append-only refinements (P4), loading cleared (P8), no portfolio mutation on generate (P9)
  - [x] 6.3 Frontend `DiscoveryPage.test.tsx` — skeleton→cards→empty states, add button calls add path
