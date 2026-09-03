# Requirements — Authentication & Production Security Hardening

> Google OAuth + password login shipped. Criteria below are leftover hardening, not the next feature.

---

## R1 — Session tokens hardened
**User story:** As a user, I want my session to be secure, so that my account can't be hijacked.

**Acceptance criteria:**
- THE SYSTEM SHALL issue short-lived (~15m) access tokens and rotating refresh tokens (P2).
- THE SYSTEM SHALL store tokens in httpOnly Secure SameSite cookies, never in JS-readable storage (P3).
- WHEN a used refresh token is replayed, THE SYSTEM SHALL revoke the entire token family (P6).

## R2 — Real logout / revocation
**User story:** As a user, I want logout to actually end my session.

**Acceptance criteria:**
- WHEN a user logs out, THE SYSTEM SHALL block the access token's `jti` and invalidate the refresh family (P1).
- THE SYSTEM SHALL reject any subsequent request using the revoked tokens with 401 (P1).

## R3 — Fail-closed authorization
**Acceptance criteria:**
- THE SYSTEM SHALL treat any missing/malformed/expired/revoked token as unauthenticated (401) and SHALL never raise (P4).
- THE SYSTEM SHALL preserve the existing `login_required`/`get_current_user` contract so protected routes need no per-route changes (P12).

## R4 — Third-party login (OAuth)
**User story:** As a user, I want to sign in with Google.

**Acceptance criteria:**
- THE SYSTEM SHALL support a Google OAuth login flow alongside password login.
- THE SYSTEM SHALL map `(provider, subject)` uniquely to one account (P7).
- THE SYSTEM SHALL link to an existing account only on a provider-verified email match; otherwise create a new account (P8).
- THE SYSTEM SHALL allow `password_hash` to be NULL for OAuth-only users (P11).

## R5 — Edge hardening
**Acceptance criteria:**
- THE SYSTEM SHALL rate-limit auth endpoints and apply login lockout/backoff (P5).
- THE SYSTEM SHALL require a CSRF token on state-changing requests under cookie auth (P9).
- THE SYSTEM SHALL restrict CORS to an explicit origin allowlist in production (P10).
- THE SYSTEM SHALL set security headers (HSTS/CSP/etc.) via Talisman.

## R6 — Secret & password hygiene
**Acceptance criteria:**
- THE SYSTEM SHALL store passwords only as bcrypt hashes and never log/return them (P11).
- THE SYSTEM SHALL source all secrets/keys from env/secret store, never hardcoded (P11).
