# Design — Authentication & Production Security Hardening

> **Status:** Google login shipped; hardening leftover · **Owner:** Michael (OAuth) · **Last updated:** 2026-08-27
>
> **What shipped:** Google OAuth (`POST /auth/google`, `google_id` on `User`, login/register buttons) alongside username/password.
>
> **Still open (not next):** httpOnly cookies, rotating refresh, real logout/revocation, rate-limit/lockout, CSRF, Talisman headers. Do not start this as the next feature — 06/08 come first. Treat remaining tasks as production hardening when we are closer to launch.
>
> Original design follows.
>
> Scope: turn the current hand-rolled auth into a production-grade system. Two thrusts:
> 1. **Third-party login** — add OAuth (Google to start) alongside username/password, with safe account linking by verified email.
> 2. **Security hardening** — short-lived access tokens + rotating refresh tokens in httpOnly cookies, real logout/revocation, auth rate-limiting, CORS lockdown, security headers, and input/secret hygiene.
>
> **Current state (the baseline being hardened):** `auth.py` issues a single 24h HS256 JWT (`create_token`), `get_current_user` parses a `Bearer` token from the `Authorization` header, `login_required` gates routes, and the client stores the raw token in `localStorage` (`utils/api.ts`). Logout is a no-op (`/auth/logout` just returns 200 — tokens stay valid until expiry). There is no refresh, no revocation, no rate limiting, and no OAuth.

---

## 1. Architecture

### 1.1 Where this fits

This reworks the auth boundary that every protected route already depends on (`login_required`, `get_current_user`) and the client transport (`authPost`/`authGet`, `PrivateRoute`). The goal is to change the *mechanism* (token lifetime, storage, revocation, providers) while keeping the *contract* (`login_required`-gated routes, a "current user") stable so the rest of the app is minimally touched.

```
┌──────────────────────── CLIENT (React) ────────────────────────┐
│  LoginPage / RegisterPage                                       │
│    ├─ password form  → POST /auth/login                         │
│    └─ "Continue with Google" → /auth/oauth/google/start         │
│  AuthContext (replaces localStorage token handling)             │
│    - no token in JS; cookies are httpOnly                        │
│    - calls /auth/refresh on 401, retries once                   │
│  authPost/authGet: withCredentials:true (cookies), + CSRF header │
│  PrivateRoute: gated on /auth/@me (server is source of truth)    │
└────────────┼────────────────────────────────────────────────-─┘
             ▼  (httpOnly Secure SameSite cookies)
┌──────────────────────── SERVER (Flask) ─────────────────────────┐
│  auth_bp                                                         │
│   ├─ POST /auth/register   (rate-limited, validated)             │
│   ├─ POST /auth/login      (rate-limited, lockout-aware)         │
│   ├─ POST /auth/refresh    (rotates refresh, reuse-detection)    │
│   ├─ POST /auth/logout     (revokes refresh family + access jti) │
│   ├─ GET  /auth/@me        (current user; source of truth)       │
│   └─ OAuth: /auth/oauth/<provider>/start  +  /callback           │
│                                                                  │
│  services/token_service.py  access(jwt,~15m) + refresh(rotating) │
│  services/oauth_service.py  Authlib; verified-email linking      │
│  TokenBlocklist (Redis) · RefreshToken (DB) · OAuthIdentity (DB) │
│  Flask-Limiter · Flask-Talisman (headers) · CORS allowlist       │
└──────────────────────────────────────────────────────────────--┘
```

### 1.2 Key architectural decisions

- **Access/refresh split with rotation.** Access tokens are short-lived JWTs (~15 min) carrying a `jti`; refresh tokens are long-lived, opaque, stored hashed in the DB, and **rotated** on every use. This bounds the blast radius of a stolen access token and enables real revocation. See **P2**, **P6**.

- **Tokens move to httpOnly Secure cookies; drop `localStorage`.** JS can no longer read the token, neutralizing token theft via XSS. This requires `SameSite` cookies + a CSRF token for state-changing requests, and `withCredentials` on the client. See **P3**, **P9**.

- **Real logout via revocation.** Logout adds the access token's `jti` to a Redis blocklist (TTL = remaining lifetime) and invalidates the refresh-token family in the DB. `get_current_user` checks the blocklist, so a logged-out token is rejected immediately rather than living until expiry. See **P1**.

- **Fail-closed authorization.** `login_required`/`get_current_user` deny by default: any missing, malformed, expired, or revoked token yields `401`. No code path treats an unverifiable token as authenticated. See **P4**.

- **OAuth as an additional identity, linked by *verified* email.** A `User` may have a password and/or one or more `OAuthIdentity` rows (provider + subject id). Linking an OAuth login to an existing account happens only when the provider asserts a **verified** email matching an existing user; otherwise a new account is created. Passwords become optional for OAuth-only users. See **P7**, **P8**.

- **Defense in depth at the edges.** Flask-Limiter throttles auth endpoints (and supports login lockout/backoff), Flask-Talisman sets security headers (HSTS, CSP, etc.), CORS is restricted to an explicit origin allowlist, and all secrets come from env/secret store. See **P5**, **P10**, **P11**.

### 1.3 Auth flows

- **Password login:** validate → issue access cookie + refresh cookie → `@me` works.
- **OAuth login:** `/start` redirects to provider → `/callback` verifies, finds/links/creates user via verified email → issues cookies.
- **Refresh:** client hits a protected route, gets `401`, calls `/auth/refresh`; server validates the refresh token, detects reuse (revokes family if reused), rotates it, issues a new access token, retries.
- **Logout:** revoke access `jti` + refresh family; clear cookies.

---

## 2. Components and Interfaces

### 2.1 Server — token service

```python
# server/app/services/token_service.py
import time, secrets, jwt

ACCESS_TTL  = 15 * 60          # 15 minutes
REFRESH_TTL = 30 * 24 * 3600   # 30 days

def issue_access_token(user_id: str) -> str:
    """Short-lived HS256 (or RS256) JWT with a unique jti for revocation."""
    jti = secrets.token_urlsafe(16)
    payload = {"user_id": user_id, "jti": jti, "type": "access",
               "exp": int(time.time()) + ACCESS_TTL}
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")

def issue_refresh_token(user_id: str, family_id: str | None = None) -> str:
    """Opaque token; only its hash + family is stored in RefreshToken. Rotated on use."""
    ...

def verify_access_token(token: str) -> dict | None:
    """Decode + validate signature/exp/type AND check jti not in TokenBlocklist.
    Returns claims or None (fail-closed)."""
    ...

def rotate_refresh(token: str) -> tuple[str, str] | None:
    """Validate refresh; if already-used (reuse) → revoke whole family, return None.
    Else mark used, issue successor in same family, return (new_refresh, user_id)."""
    ...

def revoke_access(jti: str, ttl: int) -> None: ...     # add to Redis blocklist
def revoke_refresh_family(family_id: str) -> None: ...  # DB invalidate
```

### 2.2 Server — hardened `get_current_user` / decorator

```python
# server/app/routes/auth.py  (reworked, contract preserved)
def get_current_user():
    """Source token from the httpOnly access cookie (fallback: Authorization
    header for API clients). Verify via token_service (signature, exp, type,
    blocklist). Return User or None. Never raises; fail-closed."""
    token = request.cookies.get("access_token") or _bearer_from_header()
    claims = verify_access_token(token) if token else None
    if not claims:
        return None
    return User.query.filter_by(id=claims["user_id"]).first()

# login_required unchanged in signature; now also enforces CSRF on unsafe methods.
```

### 2.3 Server — OAuth service + routes

```python
# server/app/services/oauth_service.py  (Authlib)
def upsert_user_from_oauth(provider: str, profile: dict) -> User:
    """
    profile = {sub, email, email_verified, name}.
    - If OAuthIdentity(provider, sub) exists → return its user.
    - Elif email_verified and a User with that email exists → link (create identity).
    - Else → create User (password_hash NULL) + OAuthIdentity + Portfolio.
    Never links on an unverified email.
    """
    ...
```

```python
# routes: /auth/oauth/<provider>/start  → redirect; /auth/oauth/<provider>/callback → cookies
```

### 2.4 Client — AuthContext + transport

```typescript
// client/src/auth/AuthContext.tsx
interface AuthState {
  user: { username: string; email: string } | null;
  loading: boolean;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  startOAuth: (provider: "google") => void;     // window.location → /auth/oauth/google/start
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;               // calls /auth/refresh
}
// Tokens are httpOnly cookies — never read in JS. user comes from GET /auth/@me.
```

```typescript
// utils/api.ts changes:
// - axios.defaults.withCredentials = true  (send cookies)
// - attach CSRF header from a readable csrf cookie on unsafe methods
// - 401 interceptor: try refresh() once; on failure → redirect to /login
// - remove localStorage token usage entirely
```

---

## 3. Data Models

### 3.1 `User` (extended)

```python
class User(db.Model):
    # existing: id, username, email, password_hash, budget, risk_tolerance_score, time_created
    password_hash = db.Column(db.String(128), nullable=True)   # NULL for OAuth-only users
    email_verified = db.Column(db.Boolean, default=False)
    failed_login_count = db.Column(db.Integer, default=0)      # lockout/backoff
    locked_until = db.Column(db.DateTime, nullable=True)
```

### 3.2 New tables

```python
class OAuthIdentity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id  = db.Column(db.String(32), db.ForeignKey("user.id"), nullable=False)
    provider = db.Column(db.String(32), nullable=False)   # "google"
    subject  = db.Column(db.String(255), nullable=False)  # provider's stable user id
    __table_args__ = (db.UniqueConstraint("provider", "subject"),)

class RefreshToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id   = db.Column(db.String(32), db.ForeignKey("user.id"), nullable=False)
    family_id = db.Column(db.String(43), index=True, nullable=False)  # rotation family
    token_hash = db.Column(db.String(64), unique=True, nullable=False) # sha256, never raw
    used = db.Column(db.Boolean, default=False)            # reuse detection
    revoked = db.Column(db.Boolean, default=False)
    expires_at = db.Column(db.DateTime, nullable=False)
```

`TokenBlocklist` is a Redis set/keyspace (`blocklist:<jti>` with TTL), not a table — fast membership checks per request.

### 3.3 Config / secrets

`SECRET_KEY`, `GOOGLE_CLIENT_ID/SECRET`, cookie flags (`Secure`, `HttpOnly`, `SameSite=Lax/Strict`), `CORS_ALLOWED_ORIGINS`, and limiter storage URL all come from env (`.env.example` extended). No secret is committed.

---

## 4. Correctness Properties

### P1 — Logout actually revokes
After `POST /auth/logout`, the access token's `jti` is in the blocklist and the refresh family is invalidated. Any subsequent request with the old access or refresh token is rejected with `401`. Logout is no longer a no-op that leaves tokens valid until expiry.

### P2 — Access tokens are short-lived; refresh rotates
Access tokens expire in ~15 minutes. Each refresh use issues a new refresh token in the same family and marks the old one used. A stolen access token is useful only briefly, and a stolen refresh token can be detected and neutralized.

### P3 — Tokens are not reachable from JavaScript
Access and refresh tokens live in httpOnly Secure cookies; no code path writes them to `localStorage`/`sessionStorage` or exposes them to JS. An XSS payload cannot exfiltrate the session token.

### P4 — Authorization fails closed
`get_current_user` returns `None` (→ `401`) for any token that is missing, malformed, wrong-type, expired, or blocklisted, and never raises. There is no branch where an unverifiable token is treated as authenticated.

### P5 — Auth endpoints are rate-limited and lockout-aware
`register`, `login`, `refresh`, and OAuth callbacks are throttled per IP/account; repeated failed logins increment `failed_login_count` and apply `locked_until` backoff. Brute-force and credential-stuffing are bounded.

### P6 — Refresh-token reuse invalidates the family
If a refresh token that was already used is presented again (the signature of theft), the entire token family is revoked, forcing re-authentication. A replayed refresh token cannot mint new sessions.

### P7 — One OAuth identity maps to exactly one account
`(provider, subject)` is unique; a given external identity always resolves to a single `User`. Logging in twice with the same Google account never creates a second account.

### P8 — Account linking requires a verified email
An OAuth login is linked to an existing password account only when the provider asserts a verified email matching that account. Unverified emails never link to or take over an existing account; they create a fresh account instead.

### P9 — State-changing requests are CSRF-protected
With cookie-based auth, unsafe methods require a matching CSRF token (double-submit cookie/header). A cross-site request that rides the user's cookies but lacks the CSRF token is rejected.

### P10 — CORS is restricted to an allowlist
Cross-origin requests are accepted only from explicitly configured origins; credentials are not exposed to arbitrary origins. The wildcard/dev-open configuration is not used in production.

### P11 — Secrets and password material are protected
Passwords are stored only as bcrypt hashes (one-way, salted), are never logged or returned in any response, and `password_hash` may be `NULL` only for OAuth-only users. All keys/secrets are read from env/secret store, never hardcoded or committed.

### P12 — The route contract is preserved
Existing protected routes keep working through `login_required`/`get_current_user` without per-route changes. The hardening changes the token mechanism and storage, not the authorization contract each route relies on.

---

## 5. Resolved decisions (confirmed)

1. **Access (~15m JWT) + rotating refresh**, httpOnly Secure SameSite cookies; drop `localStorage` tokens.
2. **Real logout via Redis jti blocklist + refresh-family revocation.**
3. **OAuth via Authlib, Google first**, account linking only on verified email; passwords optional for OAuth users.
4. **Flask-Limiter + Flask-Talisman + CORS allowlist + CSRF** as the production edge hardening.
5. **Contract-preserving:** `login_required`/`get_current_user` stay the integration point so the rest of the app is largely untouched.
