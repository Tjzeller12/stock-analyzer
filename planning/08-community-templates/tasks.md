# Tasks — Community Analysis Templates & Saveable Preferences

> (Rn) requirement · (Pn) property. Extends existing `AnalysisTemplate`. Pairs with feature 06 (`visible_columns`) and feature 10 (verified return).

- [ ] 1. Model & migration
  - [ ] 1.1 Extend `AnalysisTemplate` — add `config` JSON, `is_public`, `star_count` (indexed) (R1, R5)
  - [ ] 1.2 Add `TemplateStar(user_id, template_id, time_created)` with `UNIQUE(user_id, template_id)` (R5, P11)
  - [ ] 1.3 Update `to_dict(current_user_id, starred_ids)` — `config`, `is_owner`, `creator_name`, `star_count`, `is_starred`, `verified_return_pct` (R2, R5, R6)
  - [ ] 1.4 Alembic migration: add columns, create `template_star`, backfill `config` from `equations` (R1)

- [ ] 2. Default seeding
  - [ ] 2.1 Create `server/app/services/template_seed.py` with `DEFAULT_TEMPLATES` + idempotent `seed_default_templates()` (R3, P1)
  - [ ] 2.2 Call it at startup alongside `seed_filters()` (R3)

- [ ] 3. Routes
  - [ ] 3.1 Create `server/app/routes/templates.py` blueprint; register it
  - [ ] 3.2 `GET /templates?sort=` — defaults/mine/community, `_apply_community_sort` by stars|verified_return|newest, `starred_ids` set (R2, R4, R5, P13)
  - [ ] 3.3 `POST /templates` — `validate_template_config`, owner = current user (R1, P9, P10)
  - [ ] 3.4 `PUT /templates/<id>` / `DELETE /templates/<id>` — owner-only, defaults immutable (R4, P4, P5)
  - [ ] 3.5 `POST /templates/<id>/share` — owner-only toggle `is_public` (R4)
  - [ ] 3.6 `POST|DELETE /templates/<id>/star` — idempotent, sync `star_count` in same txn (R5, P11, P12)

- [ ] 4. Client: types & hook
  - [ ] 4.1 Add `AnalysisTemplateConfig`, `AnalysisTemplateDTO`, `TemplateLibrary`, `CommunitySort` to `types.ts`
  - [ ] 4.2 Create `client/src/hooks/useTemplateManager.tsx` — refresh(sort), apply (swap radar+columns), save/update/delete/share, `toggleStar` (optimistic), `cloneTemplate` (R2, R4, R5, P2, P6)
  - [ ] 4.3 Add `TEMPLATE_ENDPOINTS` to `constants/api.ts`

- [ ] 5. Client: components
  - [ ] 5.1 Create `components/common/TemplateSelector.tsx` — Starter/My/Community sections, sort control, star badges (R2, R5)
  - [ ] 5.2 Create `components/common/SaveTemplateModal.tsx` (R1)
  - [ ] 5.3 Create `components/common/StarButton.tsx` (R5)
  - [ ] 5.4 Wire apply → `setActiveTemplate` + feature 06 `setVisibleColumns`; place selector in `ControlPanel`/`StockTable` (R2, P3)

- [ ] 6. Tests
  - [ ] 6.1 Backend `test_templates.py` — idempotent seed (P1), ownership guards 403 (P4), defaults immutable + clone (P5, P6), config validation (P9), star idempotency + count consistency (P11, P12), community sort (P13)
  - [ ] 6.2 Frontend `useTemplateManager.test.tsx` — apply swaps both states non-destructively (P2, P3), optimistic star toggle, clone independence (P6)
