# Design — Personalization & Onboarding

> **Status:** Design (awaiting alignment) · **Owner:** TBD · **Last updated:** 2026-06-13
>
> Scope: the user-profiling foundation that the rest of the discovery/personalization features depend on. Three deliverables:
> 1. **Investor Profiling Questionnaire** — a multi-step, scenario-based onboarding flow that captures behavioral risk tolerance, time horizon, and budget.
> 2. **Sector "Pros & Cons" Selection Matrix** — an onboarding step where the user picks any sectors they like after seeing each sector's pitch + reality-check.
> 3. **Personalization propagation** — turning the saved profile into (a) a suggested default `RadarTemplate`, (b) donut-chart weighting hints, and (c) a bounded profile-context string injected into downstream Claude prompts (Super Prompt, Peer Matchmaker, etc.).
>
> This document is the source of truth for `requirements.md` and `tasks.md` in this folder. It is intentionally low-level.

---

## 1. Architecture

### 1.1 Where this fits in the existing system

The app today has no onboarding or discovery surface — `App.tsx` only routes `/login`, `/register`, `/profile`, `/main`, `/stock/:symbol`. The `User` model **already** carries `budget: Float` and `risk_tolerance_score: Float`, and an `AnalysisTemplate` table already exists. This feature extends those rather than replacing them.

```
┌──────────────────────── CLIENT (React) ────────────────────────┐
│                                                                  │
│  /register ──► /onboarding ──► /main                             │
│       (new user)   │                                             │
│                    │                                             │
│   OnboardingPage (orchestrator)                                  │
│     ├─ useOnboardingManager()  ── draft state (localStorage)     │
│     ├─ <OnboardingProgressBar/>                                  │
│     └─ Steps[] (rendered one at a time):                         │
│          1. WelcomeStep                                          │
│          2. ScenarioQuestionStep  (× N behavioral questions)    │
│          3. TimeHorizonStep                                      │
│          4. BudgetStep                                          │
│          5. SectorMatrixStep      (Pros/Cons grid, pick ≤ 3)    │
│          6. ReviewStep            (derived tags preview)        │
│                    │ PUT /profile/investor (on finish)          │
└────────────────────┼─────────────────────────────────────────-─┘
                      ▼
┌──────────────────────── SERVER (Flask) ─────────────────────────┐
│  profile_bp                                                      │
│   ├─ GET  /profile/investor   → InvestorProfile.to_dict()        │
│   └─ PUT  /profile/investor   → validate → map → persist (atomic)│
│                    │                                             │
│   services/profile_mapper.py     (pure, deterministic)           │
│     map_answers_to_profile(answers) -> ProfileResult             │
│                    │                                             │
│   services/personalization.py    (read-only derivations)         │
│     ├─ build_profile_context(user) -> str   (prompt-injectable)  │
│     ├─ suggest_default_template(profile) -> RadarTemplate dict    │
│     └─ budget_band(profile) -> "micro"|"standard"|"high"         │
│                    │                                             │
│   models.InvestorProfile  (1:1 User)  +  User.budget/risk sync   │
└──────────────────────────────────────────────────────────────--┘
```

### 1.2 Key architectural decisions

- **New `InvestorProfile` table, 1:1 with `User`, is the source of truth.** The richer profile (time horizon, raw answers, derived tags, sector list, completion flag) does not belong inline on `User`. The two scalar columns that already exist on `User` (`budget`, `risk_tolerance_score`) are **kept and denormalized** so existing code/tests (and the future deterministic-portfolio feature, which reads `User.budget`) keep working. `profile_mapper` writes both places in one transaction. See Correctness Property **P8 (Budget single source of truth)**.

- **Mapping answers → tags/scores is pure Python, never AI.** Risk score, risk tag, and horizon tag are computed deterministically from a static scoring map. The user explicitly wants finance-adjacent derivations to be predictable, not LLM-driven. AI only consumes the resulting profile later (downstream features), it never produces it. See **P2 (Deterministic mapping)**.

- **Draft lives entirely client-side until "Finish".** No partial writes to the DB. The whole profile is submitted as one atomic `PUT`. This keeps the schema free of "half-finished" states and makes the flow resumable from `localStorage`. See **P1 (Idempotent onboarding)** and **P3 (Draft survives reload)**.

- **Questionnaire content is config-as-data, not hardcoded JSX.** Both the behavioral questions and the sector matrix are declared as typed constant arrays (`QUESTIONNAIRE`, `SECTORS`). Steps render generically from config. This lets us add/reorder questions without touching component logic and lets the *same* scoring map be unit-tested in isolation.

- **Onboarding gating is soft, not hard.** A user with an incomplete profile is *redirected* to `/onboarding` on first entry to a protected route, but the flow is **skippable** (a "Skip for now" affordance) so an incomplete profile never bricks the core app. Defaults fill the gaps. See **P4 (Incomplete profile never blocks)**.

### 1.3 Request/data flow (happy path)

1. New user registers → client checks profile completeness via `GET /profile/investor` → `onboarding_completed=false` → redirect to `/onboarding`.
2. User progresses through steps; every answer updates the in-memory draft and is debounced-persisted to `localStorage` under `alphabot.onboarding.draft.v1`.
3. On **Review** the client computes a *preview* of derived tags using the same shared scoring map (client mirror) so the user sees "Aggressive / 10+ Years" before saving.
4. On **Finish** → `PUT /profile/investor` with the full answer payload → server re-runs `map_answers_to_profile` (server is authoritative; client preview is cosmetic) → persists `InvestorProfile` + syncs `User.budget`/`User.risk_tolerance_score` in one commit → clears the draft.
5. Subsequent personalized features call `build_profile_context(user)` / `suggest_default_template(profile)` on demand.

---

## 2. Components and Interfaces

### 2.1 Shared types (client) — `client/src/types.ts` additions

```typescript
// --- Investor profile (mirrors server InvestorProfile.to_dict()) ---
export type RiskTag = "Conservative" | "Balanced" | "Growth" | "Aggressive";
export type HorizonTag = "Short" | "Medium" | "Long" | "Very Long"; // <2y / 2-5y / 5-10y / 10y+
export type BudgetBand = "micro" | "standard" | "high";

export interface InvestorProfile {
  risk_tolerance_score: number;        // 0–100, deterministic
  risk_tag: RiskTag;
  time_horizon_years: number;          // raw answer, e.g. 12
  horizon_tag: HorizonTag;
  budget: number;                      // USD, >= 0
  preferred_sectors: string[];         // <= 3 canonical sector keys
  onboarding_completed: boolean;
  updated_at: string | null;           // ISO 8601
}

// --- Questionnaire config (static, drives the UI generically) ---
export type ScoringDimension = "risk" | "horizon";

export interface AnswerOption {
  id: string;                          // stable key, persisted in raw answers
  label: string;                       // e.g. "Buy more — it's on sale"
  /** Points contributed per dimension when this option is chosen. */
  weights: Partial<Record<ScoringDimension, number>>;
}

export interface ScenarioQuestion {
  id: string;                          // stable key, e.g. "q_market_crash"
  prompt: string;                      // scenario text
  helper?: string;                     // optional sub-text
  options: AnswerOption[];             // single-select
  dimension: ScoringDimension;         // which axis this question scores
}

export interface SectorInfo {
  key: string;                         // canonical key matching StockMaster.sector
  label: string;                       // display name, e.g. "Technology"
  icon?: string;                       // optional emoji/asset id
  pitch: string[];                     // Pros — bullet points
  realityCheck: string[];              // Cons — bullet points
}

// --- The mutable draft held during onboarding ---
export interface OnboardingDraft {
  version: 1;
  answers: Record<string, string>;     // questionId -> selected optionId
  timeHorizonYears: number | null;
  budget: number | null;
  selectedSectors: string[];           // ordered, <= 3
  stepIndex: number;                   // for resume
}
```

### 2.2 `useOnboardingManager` hook — `client/src/hooks/useOnboardingManager.tsx`

Single owner of draft state, persistence, navigation, derived-tag preview, and submission. Mirrors the existing manager-hook pattern (`useStockTableManager`, `useNewsListManager`).

```typescript
export interface UseOnboardingManager {
  draft: OnboardingDraft;
  stepIndex: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;

  // mutation
  answerQuestion: (questionId: string, optionId: string) => void;
  setTimeHorizon: (years: number) => void;
  setBudget: (usd: number) => void;
  toggleSector: (key: string) => void;          // enforces <= 3 client-side

  // navigation
  next: () => void;                               // guarded: cannot advance if step invalid
  back: () => void;
  goToStep: (i: number) => void;

  // derivation (client mirror of server mapper — cosmetic preview only)
  previewProfile: () => Pick<InvestorProfile,
    "risk_tolerance_score" | "risk_tag" | "horizon_tag">;

  // lifecycle
  isStepValid: (i: number) => boolean;
  submit: () => Promise<InvestorProfile>;         // PUT /profile/investor, clears draft on 200
  reset: () => void;                              // wipes localStorage draft

  submitting: boolean;
  error: string | null;
}

export function useOnboardingManager(
  initial?: Partial<OnboardingDraft>
): UseOnboardingManager;
```

Persistence contract: every mutation writes the draft to `localStorage["alphabot.onboarding.draft.v1"]` (debounced ~300ms). On mount the hook hydrates from that key if present and not stale. `submit()` removes the key only after a `200`.

### 2.3 Page + step components

```typescript
// client/src/pages/OnboardingPage.tsx
// Orchestrator: owns useOnboardingManager, renders the active step + progress bar +
// nav buttons. Soft-gated route. On submit success → navigate("/main").
const OnboardingPage: React.FC = () => { /* ... */ };

// client/src/components/onboarding/OnboardingProgressBar.tsx
interface OnboardingProgressBarProps {
  current: number;          // 0-indexed
  total: number;
  labels?: string[];
}

// client/src/components/onboarding/ScenarioQuestionCard.tsx
interface ScenarioQuestionCardProps {
  question: ScenarioQuestion;
  selectedOptionId: string | null;
  onSelect: (optionId: string) => void;
}

// client/src/components/onboarding/BudgetStep.tsx
interface BudgetStepProps {
  value: number | null;
  onChange: (usd: number) => void;
  // shows a low-budget hint ("Consider broad index funds like the S&P 500")
  // when value < LOW_BUDGET_THRESHOLD — feeds the deterministic-portfolio feature.
}

// client/src/components/onboarding/SectorMatrix.tsx
interface SectorMatrixProps {
  sectors: SectorInfo[];          // from constants
  selected: string[];             // <= 3
  onToggle: (key: string) => void;
  maxSelections?: number;         // default 3
}

// client/src/components/onboarding/SectorCard.tsx
interface SectorCardProps {
  sector: SectorInfo;
  isSelected: boolean;
  isDisabled: boolean;            // true when max reached and not already selected
  onToggle: () => void;
  // hover/focus or tap expands to reveal pitch (Pros) + realityCheck (Cons)
}

// client/src/components/onboarding/ReviewStep.tsx
interface ReviewStepProps {
  preview: Pick<InvestorProfile, "risk_tag" | "horizon_tag" | "budget" | "preferred_sectors">;
}
```

### 2.4 Static config — `client/src/constants/`

```typescript
// client/src/constants/onboarding.ts
export const QUESTIONNAIRE: ScenarioQuestion[] = [
  {
    id: "q_market_crash",
    dimension: "risk",
    prompt: "The market just dropped 30% in a month. Your portfolio is deep red. You…",
    options: [
      { id: "buy_more", label: "Buy more — everything's on sale", weights: { risk: 30 } },
      { id: "hold",     label: "Hold and wait it out",            weights: { risk: 20 } },
      { id: "trim",     label: "Sell some to sleep at night",     weights: { risk: 10 } },
      { id: "exit",     label: "Sell everything, cash is safe",   weights: { risk: 0 } },
    ],
  },
  // ... additional scenario questions (sleep-at-night vs moonshot, etc.)
];

export const LOW_BUDGET_THRESHOLD = 500; // USD; below this, surface index-fund guidance

// client/src/constants/sectors.ts
export const SECTORS: SectorInfo[] = [
  {
    key: "Technology",
    label: "Technology",
    pitch: ["Highest historical growth", "Innovation & scalability"],
    realityCheck: ["Sensitive to interest rates", "Valuations can imply an AI bubble"],
  },
  // ... Healthcare, Financials, Energy, Consumer, Industrials, etc.
];
```

> **Note:** `SectorInfo.key` MUST match the values stored in `StockMaster.sector` so that `preferred_sectors` can be used directly as a scope/filter by downstream features (discovery engine, deterministic portfolio) without a translation layer.

### 2.5 Server — model, routes, services

```python
# server/app/routes/profile.py  (additions to existing bp)

@bp.route("/investor", methods=["GET"])
def get_investor_profile():
    """Return the current user's InvestorProfile (or a default, completed=False, shell)."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not logged in"}), 401
    profile = user.investor_profile or InvestorProfile.empty_for(user)
    return jsonify(profile.to_dict()), 200


@bp.route("/investor", methods=["PUT"])
def upsert_investor_profile():
    """
    Validate raw onboarding answers, deterministically map them to a profile,
    and persist atomically. Also syncs User.budget / User.risk_tolerance_score.
    """
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not logged in"}), 401

    payload = request.get_json() or {}
    ok, err = validate_onboarding_payload(payload)        # shape + bounds + sector cap
    if not ok:
        return jsonify({"error": err}), 400

    result = map_answers_to_profile(payload)              # pure, deterministic
    persist_investor_profile(user, result)                # single transaction
    return jsonify(user.investor_profile.to_dict()), 200
```

```python
# server/app/services/profile_mapper.py  (pure, no I/O, no AI)

from dataclasses import dataclass

@dataclass(frozen=True)
class ProfileResult:
    risk_tolerance_score: float       # 0–100
    risk_tag: str                     # "Conservative" | "Balanced" | "Growth" | "Aggressive"
    time_horizon_years: int
    horizon_tag: str                  # "Short" | "Medium" | "Long" | "Very Long"
    budget: float
    preferred_sectors: list[str]      # <= 3
    raw_answers: dict                 # echoed back for audit/resume

RISK_BANDS = [(0, 25, "Conservative"), (25, 50, "Balanced"),
              (50, 75, "Growth"), (75, 101, "Aggressive")]

def map_answers_to_profile(payload: dict) -> ProfileResult:
    """
    Aggregate per-question option weights into a 0–100 risk score, bucket into a
    tag, bucket the horizon, clamp budget, and dedupe/cap sectors. Pure function:
    identical input -> identical output. Missing answers contribute the neutral
    midpoint, never NaN.
    """
    ...

def validate_onboarding_payload(payload: dict) -> tuple[bool, str | None]:
    """Bounds + shape checks. Rejects > 3 sectors, negative budget, unknown ids."""
    ...
```

```python
# server/app/services/personalization.py  (read-only derivations consumed downstream)

def build_profile_context(user) -> str:
    """
    Produce a BOUNDED, fixed-schema string summarizing the profile for injection
    into Claude prompts (Super Prompt, Peer Matchmaker). Hard length cap so it can
    never blow the token budget. Returns "" if no completed profile.

    Example output:
      <investor_profile>
      risk: Aggressive (82/100)
      horizon: Very Long (12y)
      budget_band: standard
      preferred_sectors: Technology, Healthcare
      </investor_profile>
    """
    ...

def suggest_default_template(profile) -> dict:
    """
    Map a profile to a starting RadarTemplate dict (same shape as
    AdvancedSettingsPanel.DEFAULT_TEMPLATE). e.g. Aggressive+Long → weight Growth/
    Efficiency higher; Conservative → weight Stability/Valuation higher.
    NEVER overwrites a user's saved custom template — it is only a *suggested*
    starting point surfaced in the UI. See Correctness Property P7.
    """
    ...

def budget_band(profile) -> str:
    """'micro' (< LOW_BUDGET_THRESHOLD), 'standard', or 'high'. Used by the
    deterministic-portfolio feature for the index-fund fallback decision."""
    ...
```

---

## 3. Data Models

### 3.1 New table — `InvestorProfile` (1:1 with `User`)

```python
# server/app/models.py

class InvestorProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(32), db.ForeignKey('user.id'), unique=True, nullable=False)

    # --- Deterministic derived values ---
    risk_tolerance_score = db.Column(db.Float, default=50.0)   # 0–100
    risk_tag = db.Column(db.String(20))                        # Conservative..Aggressive
    time_horizon_years = db.Column(db.Integer)                 # raw, e.g. 12
    horizon_tag = db.Column(db.String(20))                     # Short..Very Long

    # --- Direct inputs ---
    budget = db.Column(db.Float, default=0.0)                  # denormalized to User.budget
    preferred_sectors = db.Column(db.JSON, default=list)       # <= 3 canonical keys

    # --- Audit / resume ---
    raw_answers = db.Column(db.JSON, default=dict)             # {questionId: optionId}
    onboarding_completed = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('investor_profile', uselist=False,
                                                       cascade='all, delete-orphan'))

    def to_dict(self):
        return {
            'risk_tolerance_score': self.risk_tolerance_score,
            'risk_tag': self.risk_tag,
            'time_horizon_years': self.time_horizon_years,
            'horizon_tag': self.horizon_tag,
            'budget': self.budget,
            'preferred_sectors': self.preferred_sectors or [],
            'onboarding_completed': self.onboarding_completed,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
```

### 3.2 Existing `User` columns — kept, role clarified

`User.budget` and `User.risk_tolerance_score` already exist. They remain as **denormalized convenience columns** kept in sync by `persist_investor_profile`. `InvestorProfile` is the source of truth; the `User` columns exist so existing reads (and the deterministic-portfolio feature) don't need to join. The sync invariant is **P8**.

### 3.3 Migration

A single Flask-Migrate/Alembic revision creates `investor_profile`. No data backfill needed (existing users simply have no profile until they complete onboarding; `GET` returns a `completed=False` shell). No columns are dropped.

### 3.4 JSON payload shapes

```jsonc
// PUT /profile/investor  request body
{
  "answers": { "q_market_crash": "buy_more", "q_sleep_vs_moonshot": "moonshot" },
  "time_horizon_years": 12,
  "budget": 2500,
  "preferred_sectors": ["Technology", "Healthcare"]   // server re-validates <= 3
}

// GET/PUT response body == InvestorProfile.to_dict()
{
  "risk_tolerance_score": 82.0,
  "risk_tag": "Aggressive",
  "time_horizon_years": 12,
  "horizon_tag": "Very Long",
  "budget": 2500.0,
  "preferred_sectors": ["Technology", "Healthcare"],
  "onboarding_completed": true,
  "updated_at": "2026-06-13T22:00:00"
}
```

---

## 4. Correctness Properties

These are the invariants the implementation and tests must guarantee. Each is named first, then explained.

### P1 — Onboarding is idempotent
Submitting the same answer payload any number of times produces exactly one `InvestorProfile` row for that user with identical field values. `PUT /profile/investor` is an upsert keyed on `user_id`; it never creates a second profile and never appends. Refreshing or double-clicking "Finish" is safe.

### P2 — Profile mapping is deterministic and pure
`map_answers_to_profile` has no I/O, no randomness, and no AI. The same `answers`/`budget`/`horizon` input always yields the same `risk_tolerance_score`, `risk_tag`, and `horizon_tag`. This is what lets the client preview match the server result exactly and what makes the mapping unit-testable with simple table-driven tests.

### P3 — Draft survives reload
At any step, reloading the page or closing/reopening the tab restores the exact draft (answers, budget, sectors, current step) from `localStorage`. No answered question is lost before submission. The draft is only cleared after a `200` from `PUT`.

### P4 — Incomplete profile never blocks the core app
A user who skips or abandons onboarding can still use `/main` and every existing feature. Downstream personalization degrades gracefully: `build_profile_context` returns `""`, `suggest_default_template` is simply not surfaced, and any feature reading the profile falls back to neutral defaults (risk 50, no preferred sectors). Onboarding gating is a soft redirect, not a hard wall.

### P5 — Sector selection is bounded and well-formed on both sides
There is no artificial cap below the number of canonical sectors — a user may select any/all of the 7 sectors. The server still re-validates and rejects (`400`) any payload that is malformed: more entries than there are sectors (`len(preferred_sectors) > MAX_SECTORS`, i.e. duplicates/garbage) or any unknown sector key. The client check is UX; the server check is the guarantee.

### P6 — Profile writes are atomic
`persist_investor_profile` writes the `InvestorProfile` row and the two synced `User` columns inside a single transaction. If any part fails the whole commit rolls back, so the DB never reflects a half-applied profile (e.g. updated `User.budget` but stale `InvestorProfile.budget`).

### P7 — Personalization is additive, never destructive
`suggest_default_template` only *proposes* a `RadarTemplate`; it never silently overwrites a template the user has saved or customized. The suggestion is surfaced as an opt-in ("Use suggested setup") and applying it is an explicit user action. A user's existing radar configuration is sacred.

### P8 — Budget is a single logical source of truth
`InvestorProfile.budget` and `User.budget` are always equal after any successful write (`P6` guarantees atomicity). Reads may use either, but writes go through `persist_investor_profile`, which updates both. No code path mutates only one of them.

### P9 — Risk score is monotonic in answer aggression
For any question, choosing a more aggressive option (higher `risk` weight) never *decreases* the aggregate `risk_tolerance_score`, all else equal. This sanity property guards against weight-table sign errors and is directly testable by perturbing one answer at a time.

### P10 — Unanswered questions degrade to neutral, never NaN
If a behavioral question is missing from the payload, it contributes the neutral midpoint of its dimension rather than `0`, `null`, or `NaN`. The final `risk_tolerance_score` is always a finite number in `[0, 100]` and `risk_tag`/`horizon_tag` are always one of their enum values.

### P11 — Prompt context injection is bounded
`build_profile_context` emits a fixed-schema string with a hard maximum length (target ≤ ~400 chars). Regardless of how many sectors or how verbose the profile, it can never grow unbounded and blow the downstream Claude token budget. The sector list is bounded by the fixed set of canonical sectors (P5) and the format is fixed.

### P12 — Sector keys are canonical and join-compatible
Every `SectorInfo.key` and every persisted `preferred_sectors` entry is a value that exists in the `StockMaster.sector` domain. Downstream features can filter/scope on `preferred_sectors` directly without a mapping table. Validation rejects sectors outside the known set.

---

## 5. Resolved decisions (confirmed)

1. **Gating strictness** — **Soft gate.** Incomplete profile redirects to `/onboarding` but is skippable; never blocks the core app (Property P4).
2. **Where "update later" lives** — **Reuse the step components inside the existing `/profile` page** as an "Investor Profile" section, so there is one source of UI. No separate edit route.
3. **Number of behavioral questions** — **4–6 scenario (risk) questions + 1 time-horizon + 1 budget + the sector matrix.** Content is config-as-data (`QUESTIONNAIRE`), so the exact count can be tuned without code changes.
4. **Sector list** — **Canonical keys must match the `StockMaster.sector` domain.** The shipped `SECTORS` constant will use those exact values so `preferred_sectors` is join-compatible downstream (Property P12).
```