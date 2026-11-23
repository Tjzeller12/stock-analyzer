# Feature sequence

Last updated 2026-08-27. Status is product intent, not a promise that every original task checkbox is done.

## Shipped

| # | Feature | Notes |
|---|---|---|
| 01 | Personalization & onboarding | Live. `suggest_default_template` is a lookup; feature 08 owns when it is applied. |
| 02 | Discovery engine | Live. |
| 05 | Search autocomplete | Shipped as live Alpha Vantage search (`StockSearchInput` + `/data/search`). The original local-index design is optional later polish, not a follow-up project. |
| 09 | Auth — Google login | Google OAuth + password login shipped. Cookie/refresh/rate-limit hardening in `09-auth-security` is leftover production work, not the next feature. |
| 10 | Brokerage import | Implemented on `brokerage-import` (PR). Watchlist + My Portfolio on MainPage. Community verified-return still waits on 08. |
| 06 | Radar & table refinement | Column picker (shared Watchlist + Portfolio), removable radar axes, average-based health color, Advanced panel theme tokens, Compare charts-first. |

## Next

1. **08 — Community templates** — save/apply views; **one high-quality default per investor `risk_tag`**, auto-applied until the user has their own templates.

## After that

| # | Feature | Notes |
|---|---|---|
| 07 | Deterministic allocation | Replace the AI doughnut with explainable share counts. |
| 04 | Contextual news | Ticker-aware MainPage feed. |
| 03 | Peer matchmaker | Stock page competitors. Exciting; do after the dashboard/templates loop. |
| 11 | Thematic news | Weekly discovery cards. Same: after 06/08. |

Leftover small fixes: `misc-tasks.md`.
