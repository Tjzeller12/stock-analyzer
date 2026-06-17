# Requirements — Deterministic Portfolio Distribution

> Derived from `design.md`. Property tags reference design Correctness Properties. Core principle: **no AI in the numbers.**

---

## R1 — Deterministic allocation from radar + budget
**User story:** As a user, I want the portfolio distribution computed from my own radar scoring and my budget, so that it's predictable and reflects what I value.

**Acceptance criteria:**
- THE SYSTEM SHALL compute allocation as a pure function with no AI/randomness/IO (P1).
- THE SYSTEM SHALL blend active radar axis scores into a composite using importance weights (default equal, overridable) (P7).
- THE SYSTEM SHALL produce identical output for identical inputs, independent of input ordering (P1, P10).
- THE SYSTEM SHALL normalize included weights to sum to 1 (P2).

## R2 — Exact share recommendations
**User story:** As a user, I want to know exactly how many shares of each stock to buy, so that I can act on the plan.

**Acceptance criteria:**
- THE SYSTEM SHALL recommend integer share counts with `Σ(shares × price) ≤ budget` (P3).
- THE SYSTEM SHALL perform a deterministic greedy top-up of leftover cash (P4).
- THE SYSTEM SHALL report exact, non-negative `leftover_cash` (P4).
- THE SYSTEM SHALL exclude stocks below the score floor or with missing/zero price (0 shares, 0 weight), avoiding divide-by-zero/NaN (P5, P8).

## R3 — Low-budget index fallback
**User story:** As a user with a small budget, I want to be steered toward a broad index fund, so that I don't fragment into tiny positions.

**Acceptance criteria:**
- WHEN budget < `LOW_BUDGET_THRESHOLD`, OR no stock is affordable, OR only a degenerate single-share plan is possible, THE SYSTEM SHALL recommend a broad S&P 500 ETF and allocate no single-stock shares (P6).
- THE SYSTEM SHALL make the fallback decision via fixed, explainable rules (deterministic) (P6).

## R4 — Doughnut consistency & budget source
**Acceptance criteria:**
- THE SYSTEM SHALL derive the doughnut slices directly from the plan weights so chart and table always agree (P9).
- THE SYSTEM SHALL use the request budget when provided, else `User.budget`, and echo the budget used (P11).
- THE SYSTEM SHALL replace the AI-generated doughnut data source (any Claude text remains qualitative only) (P10-design).
