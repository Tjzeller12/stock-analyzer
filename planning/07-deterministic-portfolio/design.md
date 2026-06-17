# Design — Deterministic Portfolio Distribution

> **Status:** Design (awaiting alignment) · **Owner:** TBD · **Last updated:** 2026-06-13
>
> Scope: replace the AI-generated portfolio doughnut with a **deterministic allocation engine**. Distribution is computed from (a) the stock scores produced by the user's own radar template (what they find important) and (b) the user's budget. The engine recommends the **exact number of shares** of each stock to buy, reports leftover cash, and — when the budget is too low to build a sensible position — recommends a broad index fund (e.g. S&P 500) instead.
>
> **Why deterministic:** the user's explicit principle — *"when in doubt in finances I don't want to leave it up to an AI."* Allocation must be reproducible, explainable, and testable, not a model output.
>
> **Reuses / replaces:** today the doughnut comes from Claude (`CompareResponse.doughnutChartData` parsed in `useCompareAlphaBotManager`). This feature sources the doughnut from a new `/portfolio/allocation` endpoint backed by `score_engine` scores, `StockMaster` prices, and `User.budget` (synced from feature 01). Renders into the existing `DoughnutChart`.

---

## 1. Architecture

### 1.1 Where this fits

The deterministic radar engine (`score_engine.calculate_compare_scores`) already turns a `RadarTemplate` + a set of stocks into per-axis 0–100 scores. The allocation engine consumes those scores plus prices and budget to produce weights → dollars → integer share counts. It is a **pure computation** layered on top of the existing scoring; no AI, no external calls beyond prices already in `StockMaster`.

```
┌──────────────────────── CLIENT (React) ────────────────────────┐
│  MainPage "Portfolio Distribution" card                         │
│    useAllocationManager()                                       │
│      │ POST /portfolio/allocation                               │
│      │   { symbols, template, budget?, importance? }            │
│      ├─ <DoughnutChart data=… />     (weights, sums to 100%)    │
│      └─ <AllocationTable/>           (symbol, %, $, shares)     │
│         └─ index-fallback banner when engine says so            │
└────────────┼────────────────────────────────────────────────-─┘
             ▼
┌──────────────────────── SERVER (Flask) ─────────────────────────┐
│  portfolio_bp                                                    │
│   └─ POST /portfolio/allocation                                 │
│        budget = body.budget ?? user.budget                       │
│        stocks = StockMaster.in(symbols)                          │
│        scores = calculate_compare_scores(stocks, template, …)    │
│        plan   = AllocationEngine.allocate(scores, prices,        │
│                                  budget, importance)             │
│        return plan                                               │
│                                                                  │
│  services/allocation_engine.py   (pure, deterministic, no AI)    │
│     composite_scores(scores, importance) -> {sym: float}         │
│     allocate(...) -> AllocationPlan                              │
│        ├─ exclude below floor / unpriced                         │
│        ├─ normalize weights (Σ = 1)                              │
│        ├─ dollars = budget * weight                              │
│        ├─ shares  = floor(dollars / price)                       │
│        ├─ greedy top-up of leftover (deterministic)              │
│        └─ low-budget → index fallback (VOO/SPY)                  │
└──────────────────────────────────────────────────────────────--┘
```

### 1.2 Key architectural decisions

- **Allocation is a pure function: `allocate(scores, prices, budget, importance) -> AllocationPlan`.** No randomness, no AI, no I/O. Same inputs always produce the same plan. This is the headline property (**P1**) and is what makes it unit-testable.

- **Importance comes from the user's radar, not a guess.** Each stock's **composite score** is a weighted blend of its active axis scores. The blend weights (`importance`) default to equal across active axes but can be overridden by the user (and seeded from their profile via feature 01). "What the user finds important" is therefore literally the axes they weight. See **P7**.

- **Weights are score-proportional with a floor.** Stocks scoring below a configurable floor are excluded (0%, 0 shares) so the budget isn't diluted into weak picks; remaining composite scores are normalized to sum to 1. See **P5**, **P2**.

- **Share counts are integral and strictly budget-feasible.** `shares = floor(dollars / price)`, then a **deterministic greedy top-up** spends remaining cash on the highest-weight affordable stock until nothing more fits. The total spend never exceeds the budget; leftover is reported exactly. See **P3**, **P4**.

- **Low budget → index fallback, decided deterministically.** If the budget is below `LOW_BUDGET_THRESHOLD` (shared with feature 01) **or** no individual stock is affordable (cheapest price > budget) **or** the plan can only buy a single share of one name, the engine returns an `index_fallback` recommendation (broad ETF, e.g. VOO/SPY) instead of a fragmented plan. See **P6**.

- **The doughnut is a view of the plan, not a separate computation.** Chart slices are exactly the plan weights (×100), so the chart and the share table can never disagree. See **P9**.

- **Decouple from the Claude compare path.** The deterministic allocation replaces the AI doughnut; the Claude compare *narrative* can remain as qualitative text, but the numbers come from this engine. See **P10**.

### 1.3 Data flow

1. MainPage card calls `POST /portfolio/allocation` with the selected `symbols`, the active `template`, optional `budget` (defaults to `User.budget`), and optional `importance` weights.
2. Server scores the stocks via the existing engine, then `AllocationEngine.allocate` computes the plan.
3. Response renders into `DoughnutChart` (weights) + `AllocationTable` (shares/dollars), or shows the index-fallback banner.

---

## 2. Components and Interfaces

### 2.1 Shared types (client) — `client/src/types.ts` additions

```typescript
export interface AllocationItem {
  symbol: string;
  composite_score: number;   // 0–100, blended axis score
  weight: number;            // 0–1, Σ weights = 1 across included items
  price: number;             // price used for share math
  shares: number;            // integer, >= 0
  dollars: number;           // shares * price (actual spend on this name)
  excluded: boolean;         // true → below floor / unaffordable (0 shares)
}

export interface IndexFallback {
  recommended: boolean;
  ticker: string;            // e.g. "VOO"
  reason: string;            // human-readable ("Budget below $500 — a broad index fund…")
}

export interface AllocationPlan {
  budget: number;
  items: AllocationItem[];
  total_invested: number;    // Σ dollars
  leftover_cash: number;     // budget - total_invested, >= 0
  index_fallback: IndexFallback;
}
```

### 2.2 `useAllocationManager` hook — `client/src/hooks/useAllocationManager.tsx`

```typescript
export interface UseAllocationManager {
  plan: AllocationPlan | null;
  loading: boolean;
  error: string | null;
  computeAllocation: (
    symbols: string[],
    template: RadarTemplate,
    opts?: { budget?: number; importance?: Record<string, number> }
  ) => Promise<void>;
  doughnutData: ChartData | null;   // derived from plan.items weights (P9)
}

export function useAllocationManager(): UseAllocationManager;
```

### 2.3 Components

```typescript
// client/src/components/common/AllocationTable.tsx
interface AllocationTableProps {
  plan: AllocationPlan;
  // columns: Symbol | Weight % | $ Allocated | Shares | Price ; footer: invested + leftover
}

// The existing DoughnutChart is reused; useAllocationManager.doughnutData feeds it.
// An IndexFallbackBanner renders when plan.index_fallback.recommended is true.
```

### 2.4 Server — engine + route

```python
# server/app/services/allocation_engine.py   (pure, deterministic, no AI / no I/O)
from dataclasses import dataclass

SCORE_FLOOR = 20.0          # composite below this → excluded
LOW_BUDGET_THRESHOLD = 500  # shared concept with feature 01
INDEX_FALLBACK_TICKER = "VOO"

@dataclass(frozen=True)
class AllocationItem:
    symbol: str; composite_score: float; weight: float
    price: float; shares: int; dollars: float; excluded: bool
    def to_dict(self) -> dict: ...

@dataclass(frozen=True)
class AllocationPlan:
    budget: float; items: list[AllocationItem]
    total_invested: float; leftover_cash: float; index_fallback: dict
    def to_dict(self) -> dict: ...

def composite_scores(
    scores_by_symbol: dict[str, dict[str, float]],
    importance: dict[str, float] | None,
) -> dict[str, float]:
    """Blend each stock's active-axis scores into one 0–100 composite using
    `importance` weights (default equal across axes). Pure; stable ordering."""
    ...

def allocate(
    scores_by_symbol: dict[str, dict[str, float]],
    prices: dict[str, float],
    budget: float,
    importance: dict[str, float] | None = None,
) -> AllocationPlan:
    """
    1. composite = composite_scores(...)
    2. exclude symbols with composite < SCORE_FLOOR or price <= 0 / missing
    3. if not eligible OR budget < LOW_BUDGET_THRESHOLD OR cheapest price > budget
         → index_fallback plan (all weight to INDEX_FALLBACK_TICKER guidance)
    4. weight = composite / Σ composite (eligible only)
    5. dollars_i = budget * weight_i ; shares_i = floor(dollars_i / price_i)
    6. greedy top-up: while leftover >= min affordable price, add 1 share to the
         highest-weight stock whose price <= leftover (stable tiebreak by symbol)
    7. recompute dollars_i = shares_i * price_i ; leftover = budget - Σ dollars
    Deterministic at every step.
    """
    ...
```

```python
# server/app/routes/portfolio.py   (new route)
@bp.route("/allocation", methods=["POST"])
@login_required
def portfolio_allocation():
    body = request.json or {}
    symbols  = [s.upper() for s in body.get("symbols", [])]
    template = body.get("template")
    importance = body.get("importance")
    user = get_current_user()
    budget = body.get("budget", user.budget if user else None)
    if not symbols or template is None:
        return jsonify({"error": "symbols and template are required"}), 400
    if not budget or budget <= 0:
        return jsonify({"error": "A positive budget is required"}), 400

    stocks = StockMaster.query.filter(StockMaster.symbol.in_(symbols)).all()
    scores = calculate_compare_scores(stocks, template, is_relative=True)
    prices = {s.symbol: (s.price or 0.0) for s in stocks}
    plan = allocate(scores, prices, float(budget), importance)
    return jsonify(plan.to_dict()), 200
```

---

## 3. Data Models

### 3.1 No new SQL tables

The plan is computed on demand and rendered; it isn't persisted. Inputs come from existing sources: `StockMaster.price`, the active `RadarTemplate`, and `User.budget` (kept in sync by feature 01). Optionally cacheable in Redis keyed by `(symbols, template hash, budget, importance hash)`, but determinism makes caching a pure optimization, not a correctness need.

### 3.2 JSON payload shapes

```jsonc
// POST /portfolio/allocation request
{ "symbols": ["AAPL","MSFT","KO"], "template": { /* RadarTemplate */ }, "budget": 2000,
  "importance": { "Valuation": 0.4, "Stability": 0.4, "Growth": 0.2 } }

// response (normal)
{
  "budget": 2000, "total_invested": 1944.12, "leftover_cash": 55.88,
  "items": [
    { "symbol": "MSFT", "composite_score": 78.0, "weight": 0.42, "price": 430.10, "shares": 2, "dollars": 860.20, "excluded": false },
    { "symbol": "AAPL", "composite_score": 61.0, "weight": 0.33, "price": 210.0, "shares": 3, "dollars": 630.0, "excluded": false },
    { "symbol": "KO",   "composite_score": 47.0, "weight": 0.25, "price": 60.64, "shares": 7, "dollars": 424.48, "excluded": false }
  ],
  "index_fallback": { "recommended": false, "ticker": "VOO", "reason": "" }
}

// response (low budget)
{
  "budget": 150, "total_invested": 0, "leftover_cash": 150, "items": [],
  "index_fallback": { "recommended": true, "ticker": "VOO",
    "reason": "With a $150 budget, a broad S&P 500 index fund offers better diversification than fractional single-stock positions." }
}
```

---

## 4. Correctness Properties

### P1 — Allocation is deterministic and AI-free
`allocate` is a pure function with no AI, randomness, or network I/O. Identical `(scores, prices, budget, importance)` always yields the identical `AllocationPlan`. This is the core promise of the feature and the reason it replaces the LLM doughnut.

### P2 — Weights are normalized
Across all *included* items, `Σ weight == 1` (within floating tolerance), and the doughnut therefore sums to 100%. Excluded items contribute weight 0.

### P3 — Share counts are integral and budget-feasible
Every `shares` value is a non-negative integer and `Σ (shares_i * price_i) <= budget`. The plan never recommends spending more than the budget, and never recommends fractional shares.

### P4 — Leftover cash is exact and non-negative
`leftover_cash == budget - total_invested` and `leftover_cash >= 0`. After the greedy top-up, the leftover is strictly less than the cheapest affordable included share price (you couldn't have bought one more of anything).

### P5 — Weak picks are excluded deterministically
A stock with composite score below `SCORE_FLOOR`, or with a missing/zero price, is marked `excluded` with 0 shares and 0 weight. The exclusion rule is a fixed threshold, so the same stock is always included/excluded for the same inputs.

### P6 — Low budget triggers the index fallback, deterministically
The fallback fires under a fixed, explainable rule set (budget below threshold, or no affordable stock, or only a degenerate single-share plan possible). When it fires, the plan recommends the broad index ticker and allocates no single-stock shares. The decision is reproducible and never AI-driven.

### P7 — Allocation respects importance monotonically
Holding everything else equal, increasing a stock's composite score (or increasing the importance weight of axes on which it scores well) never *decreases* its dollar allocation. Higher conviction ⇒ at least as much money.

### P8 — No division-by-zero / no NaN
Stocks with `price <= 0` or missing prices are excluded before any division. Composite scores and weights are always finite; an all-excluded input yields the index fallback rather than a NaN-laden plan.

### P9 — The doughnut equals the plan
The chart data is derived directly from `plan.items` weights, so the visual distribution and the share/dollar table are always consistent — there is no independent chart computation that could drift.

### P10 — Allocation is independent of input ordering
Permuting the order of `symbols` produces the same plan (same weights, same shares), with ties in the greedy top-up broken by a stable rule (e.g. symbol alphabetical). Order in, order out is irrelevant to the result.

### P11 — Budget source is explicit and consistent
The budget used is the request's `budget` when provided, else `User.budget` (the value synced from the investor profile in feature 01). The response always echoes the `budget` actually used so the UI can display the basis of the recommendation.

---

## 5. Resolved decisions (confirmed)

1. **Deterministic engine replaces the AI doughnut**; any Claude text remains qualitative only.
2. **Composite = importance-weighted blend of active radar axes**, importance defaulting to equal and overridable (seedable from the profile).
3. **Integer shares + deterministic greedy top-up**, exact leftover reported.
4. **Index fallback ticker** defaults to a broad S&P 500 ETF (`VOO`); threshold shared with feature 01's `LOW_BUDGET_THRESHOLD`.
5. **Score floor** excludes weak picks so the budget isn't diluted.
