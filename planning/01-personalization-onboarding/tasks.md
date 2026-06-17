# Tasks — Personalization & Onboarding

> Traceability: (Rn) = requirement, (Pn) = correctness property. Check off as completed.

- [x] 1. Data model & migration
  - [x] 1.1 Add `InvestorProfile` model (1:1 `User`) in `server/app/models.py` with fields per design §3.1 (risk score/tag, horizon years/tag, budget, `preferred_sectors` JSON, `raw_answers` JSON, `onboarding_completed`, `updated_at`) (R5)
  - [x] 1.2 Add `User.investor_profile` relationship (uselist=False, cascade delete-orphan)
  - [x] 1.3 Create Alembic migration for `investor_profile` (no backfill) (R5)
  - [x] 1.4 Add `InvestorProfile.empty_for(user)` shell + `to_dict()`

- [x] 2. Profile mapping service (pure, no AI)
  - [x] 2.1 Create `server/app/services/profile_mapper.py` with `ProfileResult` dataclass + `RISK_BANDS` (R2)
  - [x] 2.2 Implement `map_answers_to_profile(payload)` — aggregate weights → score/tag, bucket horizon, clamp budget, dedupe/cap sectors; neutral default for missing (P2, P9, P10)
  - [x] 2.3 Implement `validate_onboarding_payload(payload)` — shape + bounds + sector cap + known keys (R4, P5, P12)
  - [x] 2.4 Implement `persist_investor_profile(user, result)` — atomic write of profile + sync `User.budget`/`User.risk_tolerance_score` (P6, P8)

- [x] 3. Profile routes
  - [x] 3.1 Add `GET /profile/investor` (returns profile or completed=false shell) (R5)
  - [x] 3.2 Add `PUT /profile/investor` (validate → map → persist; idempotent upsert) (R5, P1)

- [x] 4. Personalization service
  - [x] 4.1 Create `server/app/services/personalization.py`
  - [x] 4.2 Implement `build_profile_context(user)` — bounded fixed-schema string, "" if incomplete (R6, P11)
  - [x] 4.3 Implement `suggest_default_template(profile)` → RadarTemplate dict, opt-in only (R6, P7)
  - [x] 4.4 Implement `budget_band(profile)` → micro|standard|high (R6)

- [x] 5. Client types & config
  - [x] 5.1 Add types to `client/src/types.ts`: `InvestorProfile`, `ScenarioQuestion`, `AnswerOption`, `SectorInfo`, `OnboardingDraft`, tags (R1, R2)
  - [x] 5.2 Create `client/src/constants/onboarding.ts` (`QUESTIONNAIRE`, `LOW_BUDGET_THRESHOLD`) (R1, R3)
  - [x] 5.3 Create `client/src/constants/sectors.ts` (`SECTORS`, keys matching `StockMaster.sector`) (R4, P12)

- [x] 6. Onboarding state hook
  - [x] 6.1 Create `client/src/hooks/useOnboardingManager.tsx` per design §2.2
  - [x] 6.2 Implement draft persistence to `localStorage` (debounced) + hydration on mount (P3)
  - [x] 6.3 Implement `previewProfile()` mirroring the server mapper (R2)
  - [x] 6.4 Implement `isStepValid`, guarded `next`, `toggleSector` cap, `submit()` clearing draft on 200 (R1, R5, P5)

- [x] 7. Onboarding UI
  - [x] 7.1 Create `client/src/pages/OnboardingPage.tsx` orchestrator (R1)
  - [x] 7.2 Create `components/onboarding/OnboardingProgressBar.tsx` (R1)
  - [x] 7.3 Create `components/onboarding/ScenarioQuestionCard.tsx` (R1, R2)
  - [x] 7.4 Create `components/onboarding/BudgetStep.tsx` with low-budget hint (R3)
  - [x] 7.5 Create `components/onboarding/SectorMatrix.tsx` + `SectorCard.tsx` (hover/expand, select any/all sectors) (R4)
  - [x] 7.6 Create `components/onboarding/ReviewStep.tsx` showing derived tags (R2)

- [x] 8. Routing & gating
  - [x] 8.1 Add protected `/onboarding` route in `client/src/pages/App.tsx` (R1)
  - [x] 8.2 On post-register / first protected entry, check profile completeness and soft-redirect (R1, P4)
        — register routes to `/onboarding`; `useOnboardingGate` soft-redirects from `/main`; "Skip for now" sets a session dismissal flag to prevent redirect loops.
  - [x] 8.3 Add an "Investor Profile" editing section to `Profile.tsx` reusing the step components (R5)
        — implemented as `InvestorProfileSection` summarizing the saved profile with an entry point that re-runs the full `/onboarding` step flow (one source of UI).

- [x] 9. Tests
  - [x] 9.1 Backend: `test_profile_mapper.py` — table-driven determinism, monotonicity (P9), missing-answer neutrality (P10), sector cap rejection (P5)
  - [x] 9.2 Backend: `test_investor_profile.py` — GET shell, PUT idempotency (P1), atomic budget sync (P6, P8), 400 on bad payload
  - [x] 9.3 Backend: `test_investor_profile.py::TestPersonalizationService` — bounded context length (P11), suggestion non-destructive (P7), budget_band buckets
  - [x] 9.4 Frontend: `useOnboardingManager.test.tsx` — draft persistence/restore (P3), sector cap, preview matches mapping
  - [x] 9.5 Frontend: `OnboardingPage.test.tsx` — step gating, skip path (P4), submit flow
