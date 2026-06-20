# Tasks — Authentication & Production Security Hardening

> (Rn) requirement · (Pn) property. Reworks the auth mechanism while preserving the route contract (P12). Sequence carefully — this touches every protected route + the client transport.

- [ ] 1. Token service
  - [ ] 1.1 Create `server/app/services/token_service.py` — `issue_access_token` (jti, ~15m), `issue_refresh_token` (opaque, hashed, family), `verify_access_token` (sig/exp/type + blocklist check), `rotate_refresh` (reuse detection), `revoke_access`/`revoke_refresh_family` (R1, R2, P2, P6)
  - [ ] 1.2 Wire Redis token blocklist (`blocklist:<jti>` TTL) (R2, P1)

- [ ] 2. Models & migration
  - [ ] 2.1 Extend `User`: `password_hash` nullable, `email_verified`, `failed_login_count`, `locked_until` (R4, R5, P11)
  - [ ] 2.2 Add `OAuthIdentity` (unique `provider,subject`) and `RefreshToken` (family, token_hash, used, revoked, expires_at) (R1, R4, P6, P7)
  - [ ] 2.3 Alembic migration for the above

- [ ] 3. Auth routes reworked
  - [ ] 3.1 Rework `get_current_user` — read access cookie (fallback header), verify via token_service, fail-closed (R3, P4)
  - [ ] 3.2 `POST /auth/login` / `register` — set cookies, lockout/backoff (R1, R5, P5)
  - [ ] 3.3 `POST /auth/refresh` — rotate + reuse detection (R1, P6)
  - [ ] 3.4 `POST /auth/logout` — revoke jti + refresh family, clear cookies (R2, P1)
  - [ ] 3.5 Enforce CSRF on unsafe methods in `login_required` (R5, P9)

- [ ] 4. OAuth
  - [ ] 4.1 Add Authlib; create `server/app/services/oauth_service.py` — `upsert_user_from_oauth` (verified-email linking) (R4, P7, P8)
  - [ ] 4.2 Routes `/auth/oauth/google/start` + `/callback` → issue cookies (R4)
  - [ ] 4.3 Extend `.env.example` with `GOOGLE_CLIENT_ID/SECRET`, cookie + CORS config (R5, R6)

- [ ] 5. Edge hardening
  - [ ] 5.1 Add Flask-Limiter (auth endpoints) (R5, P5)
  - [ ] 5.2 Add Flask-Talisman (security headers) (R5)
  - [ ] 5.3 Lock CORS to allowlist from env (R5, P10)

- [ ] 6. Client
  - [ ] 6.1 Update `utils/api.ts` — `withCredentials`, CSRF header, refresh-on-401-then-retry-once, remove all `localStorage` token usage (R1, R3, P3)
  - [ ] 6.2 Create `client/src/auth/AuthContext.tsx` — user from `/auth/@me`, `loginWithPassword`, `startOAuth`, `logout`, `refresh` (R1, R4)
  - [ ] 6.3 Update `LoginPage`/`RegisterPage` — "Continue with Google"; stop storing tokens (R4)
  - [ ] 6.4 Update `PrivateRoute` to gate on `/auth/@me` (R3)

- [ ] 7. Tests
  - [ ] 7.1 Backend `test_auth.py` — logout revokes (P1), fail-closed on bad/expired/revoked (P4), refresh rotation + reuse revokes family (P2, P6), rate-limit/lockout (P5), CSRF required (P9)
  - [ ] 7.2 Backend `test_oauth.py` — `(provider,subject)` uniqueness (P7), verified-email linking vs new account (P8), OAuth-only NULL password (P11)
  - [ ] 7.3 Backend — CORS allowlist enforced (P10); passwords never in responses/logs (P11)
  - [ ] 7.4 Frontend — `api.ts` refresh-retry flow; no token in storage (P3)
