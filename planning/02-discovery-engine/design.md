# Design — Discovery Engine (Super Prompt + Tailored Discovery + Refine Search)

> **Status:** Implemented · **Owner:** Thomas · **Last updated:** 2026-08-27
>
> Scope: the Claude-driven personalized discovery surface. Three deliverables:
> 1. **Super Prompt Engine** — a backend utility that interpolates the user's investor profile into a master prompt template, calls Claude, and returns a strictly-schematized list of recommended stocks.
> 2. **Tailored Discovery page** (`/discovery`) — renders the returned recommendations as clickable stock cards.
> 3. **Conversational Refine Search** — a chat-style input that appends natural-language modifiers ("Exclude EV companies", "I don't like TSLA") to the active discovery context and re-runs.
>
> **Depends on:** `01-personalization-onboarding` (`personalization.build_profile_context`, `budget_band`, `preferred_sectors`). Reuses the existing AI layer (`AlphaBotClient`, `PromptTemplate`, `StructuredAlphaBotAnalysis` conventions) and JSON-parsing patterns already used by `compare.md` / `analysis.py`.

---

## 1. Architecture

### 1.1 Where this fits

The AI layer is already the right shape for this. `AlphaBotClient.run_sync(prompt, include_tools=True)` runs a ReAct loop over the Alpha Vantage MCP, so Claude can *verify* tickers/fundamentals while building recommendations. The `compare.md` prompt already proves the "return ONLY strict JSON, no markdown fences" pattern, and `analysis.py::_parse_json` already proves the tolerant-parse pattern. The discovery engine is a new **service + prompt + page**, not new infrastructure.

```
┌──────────────────────── CLIENT (React) ────────────────────────┐
│  /discovery  (new protected route)                              │
│   DiscoveryPage                                                  │
│     ├─ useDiscoveryManager()   ── session: { refinements[], … }  │
│     ├─ <RefineSearchBar/>      ── chat-style modifier input      │
│     ├─ <DiscoveryGrid/>                                          │
│     │     └─ <DiscoveryCard/>  ── ticker, name, rationale, →     │
│     └─ skeleton loaders while a run is in flight                 │
│             │ POST /discovery/generate { refinements }           │
└─────────────┼──────────────────────────────────────────────────┘
              ▼
┌──────────────────────── SERVER (Flask) ─────────────────────────┐
│  discovery_bp                                                    │
│   └─ POST /discovery/generate                                    │
│         user = get_current_user()                                │
│         ctx  = build_profile_context(user)        (feature 01)   │
│         key  = hash(profile_signature + refinements)             │
│         cache hit? → return                                      │
│         prompt = SuperPrompt.build(ctx, refinements)             │
│         raw    = AlphaBotClient.run_sync(prompt, include_tools=T)│
│         recs   = DiscoveryParser.parse(raw)   (strict, tolerant) │
│         cache.set(key, recs, ttl)                                │
│                                                                  │
│   services/discovery.py                                          │
│     ├─ SuperPrompt.build(profile_ctx, refinements) -> str        │
│     ├─ DiscoveryParser.parse(text) -> list[Recommendation]       │
│     └─ profile_signature(user) -> str  (cache-key stability)     │
│   prompts/super_prompt.md   (master template)                    │
└──────────────────────────────────────────────────────────────--┘
```

### 1.2 Key architectural decisions

- **Server is stateless; the discovery "session" lives on the client.** The client holds the ordered list of `refinements` and resends the full list on every `generate` call. The server rebuilds the prompt deterministically from `(profile_context + refinements)`. This avoids a server-side session table and makes the result fully reproducible/cacheable. See **P3** and **P4**.

- **Recommendations are AI-generated *by design*** — unlike the deterministic donut, discovery is exploratory, so non-determinism in *which* stocks come back is acceptable. What is **not** negotiable is the **output contract**: the response is a strictly validated JSON array, and malformed model output degrades gracefully rather than crashing the page (**P2**).

- **Tools are enabled (`include_tools=True`).** Claude can call the MCP to sanity-check tickers/fundamentals so it doesn't hallucinate dead symbols. Invalid/unroutable tickers are filtered server-side regardless (**P6**).

- **Refinements are append-only and order-preserving within a session.** "Exclude EV" then "higher dividend yield" both stay in context; the second doesn't erase the first. The list is capped to protect the token budget (**P5**, **P11-bound**).

- **Discovery never mutates portfolio state.** Generating recommendations is read-only; adding a stock is a separate explicit action from a card. See **P9**.

- **Idempotent via cache.** Same `(profile_signature, refinements)` returns the cached result within TTL — consistent with the existing 15-minute analysis caching and important for Claude cost control. See **P7**.

### 1.3 Data flow (generate + refine)

1. User lands on `/discovery`. `useDiscoveryManager` issues an initial `POST /discovery/generate` with `refinements: []`.
2. Server builds context from the profile, checks cache, builds the super prompt, runs Claude (tools on), parses + validates → returns `Recommendation[]`.
3. UI renders `DiscoveryCard`s. User types "Exclude EV companies" in `RefineSearchBar`.
4. Client appends to `refinements`, shows skeleton loaders, re-`POST`s the full refinements array.
5. New (cache-keyed) result replaces the grid. Each card routes to `/stock/:symbol`; an "Add to portfolio" affordance reuses the existing `PORTFOLIO_ENDPOINTS.ADD`.

---

## 2. Components and Interfaces

### 2.1 Shared types (client) — `client/src/types.ts` additions

```typescript
export interface DiscoveryRecommendation {
  ticker: string;          // uppercased, validated
  company_name: string;
  rationale: string;       // <= 2 sentences (bounded server-side)
  sector?: string;         // optional, if Claude supplies it
}

export interface DiscoverySession {
  refinements: string[];   // ordered, append-only, capped
}

export interface DiscoveryResponse {
  recommendations: DiscoveryRecommendation[];
  generated_from: {
    has_profile: boolean;            // false → generic fallback was used
    refinement_count: number;
  };
}
```

### 2.2 `useDiscoveryManager` hook — `client/src/hooks/useDiscoveryManager.tsx`

Mirrors the existing manager-hook pattern (`useCompareAlphaBotManager`).

```typescript
export interface UseDiscoveryManager {
  recommendations: DiscoveryRecommendation[];
  refinements: string[];
  loading: boolean;
  error: string | null;
  hasProfile: boolean;

  generate: () => Promise<void>;              // initial run (refinements: [])
  refine: (modifier: string) => Promise<void>; // append + re-run (skeletons on)
  clearRefinements: () => Promise<void>;       // reset to base profile run
  goToStock: (ticker: string) => void;         // navigate /stock/:ticker
  addToPortfolio: (ticker: string) => Promise<void>; // reuse PORTFOLIO_ENDPOINTS.ADD
}

export function useDiscoveryManager(): UseDiscoveryManager;
```

Contract: `refine` enforces the client-side refinement cap (`MAX_REFINEMENTS`), trims/ignores empty input, and always toggles `loading` back off in a `finally` (no stranded skeletons — **P8**).

### 2.3 Page + components

```typescript
// client/src/pages/DiscoveryPage.tsx
// Orchestrator. On mount calls generate(). Renders RefineSearchBar + DiscoveryGrid.
// Empty-profile state shows a CTA to complete onboarding (links to feature 01).
const DiscoveryPage: React.FC = () => { /* ... */ };

// client/src/components/discovery/DiscoveryCard.tsx   (the user's example file)
interface DiscoveryCardProps {
  recommendation: DiscoveryRecommendation;
  onOpen: (ticker: string) => void;        // → /stock/:ticker
  onAdd: (ticker: string) => void;         // → add to portfolio
  loading?: boolean;                       // renders skeleton variant
}

// client/src/components/discovery/DiscoveryGrid.tsx
interface DiscoveryGridProps {
  recommendations: DiscoveryRecommendation[];
  loading: boolean;                        // true → render N skeleton cards
  skeletonCount?: number;                  // default 5
  onOpen: (ticker: string) => void;
  onAdd: (ticker: string) => void;
}

// client/src/components/discovery/RefineSearchBar.tsx
interface RefineSearchBarProps {
  onSubmit: (modifier: string) => void;    // calls refine()
  disabled?: boolean;                      // true while a run is in flight
  activeRefinements: string[];             // shown as removable chips
  onClear: () => void;
}
```

#### Shared primitive: `AddToListButton` (used anywhere stocks are listed)

A small "＋ add to my list" affordance that appears on every stock surface (discovery cards, peer rows, thematic-news cards in feature 11). It is the **canonical** wrapper around the existing add-to-portfolio path — it does not introduce a new add endpoint.

```typescript
// client/src/components/common/AddToListButton.tsx
interface AddToListButtonProps {
  symbol: string;
  onAdd: (symbol: string) => Promise<void>;   // wired to useStockTableManager.addStock
                                              // → POST PORTFOLIO_ENDPOINTS.ADD (existing code)
  size?: "sm" | "md";
}
// States: idle ("＋") → adding (spinner, disabled) → added (✓, idempotent on repeat).
// Reuses the exact same add flow as the main table; no parallel logic. See P12.
```

### 2.4 Server — route, service, prompt

```python
# server/app/routes/discovery.py
discovery_bp = Blueprint("discovery", __name__)

@discovery_bp.route("/discovery/generate", methods=["POST"])
def generate_discovery():
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not logged in"}), 401

    refinements = _sanitize_refinements(request.json.get("refinements", []))  # cap + strip
    profile_ctx = build_profile_context(user)            # "" if no completed profile
    cache_key = f"discovery:{profile_signature(user)}:{_hash(refinements)}"

    cached = cache.get(cache_key)
    if cached:
        return jsonify(cached), 200

    prompt = SuperPrompt.build(profile_ctx, refinements)
    result = AlphaBotClient.run_sync(prompt, include_tools=True)
    recs = DiscoveryParser.parse(result.text)            # strict, tolerant, dedup, filter

    payload = {
        "recommendations": [r.to_dict() for r in recs],
        "generated_from": {"has_profile": bool(profile_ctx), "refinement_count": len(refinements)},
    }
    if result.cacheable and recs:
        cache.set(cache_key, payload, timeout=900)
    return jsonify(payload), 200
```

```python
# server/app/services/discovery.py
from dataclasses import dataclass

@dataclass(frozen=True)
class Recommendation:
    ticker: str
    company_name: str
    rationale: str
    sector: str | None = None
    def to_dict(self) -> dict: ...

MAX_REFINEMENTS = 8
MAX_RECOMMENDATIONS = 8

class SuperPrompt:
    @staticmethod
    def build(profile_ctx: str, refinements: list[str]) -> str:
        """
        Render prompts/super_prompt.md with the bounded profile context and a
        rendered, numbered refinement block. If profile_ctx is empty, the template
        instructs Claude to produce a sensible *generic* long-term starter list.
        Deterministic string construction for a stable cache key.
        """
        ...

class DiscoveryParser:
    @staticmethod
    def parse(text: str) -> list[Recommendation]:
        """
        Tolerant strict parse (same cleanup as analysis.py::_parse_json):
          - strip ```json fences, json.loads
          - require a top-level array of objects
          - coerce/validate each: ticker uppercased + non-empty, rationale truncated
            to <= 2 sentences, drop entries missing required fields
          - dedupe by ticker, cap at MAX_RECOMMENDATIONS
          - on total parse failure return [] (never raise) — page shows empty state
        """
        ...

def profile_signature(user) -> str:
    """Stable hash of the profile fields that affect recommendations
    (risk_tag, horizon_tag, budget_band, sorted preferred_sectors).
    Changing the profile busts the discovery cache; cosmetic changes don't."""
    ...
```

```markdown
<!-- server/app/prompts/super_prompt.md (sketch) -->
You are AlphaBot's long-term stock discovery engine.

# Investor Profile
{profile_context}      <!-- bounded block from feature 01; may be empty -->

# User Refinements (apply in order, later ones take precedence)
{refinements_block}    <!-- e.g. "1. Exclude EV companies\n2. Prefer dividend yield > 3%" -->

# Task
Recommend {max_recommendations} long-term candidate stocks tailored to the profile and
refinements. You may use tools to verify tickers and fundamentals. Do not recommend
delisted or non-existent tickers.

# Output Format
Return ONLY a raw JSON array. No markdown fences, no prose. Each element:
{ "ticker": "MSFT", "company_name": "Microsoft", "rationale": "<= 2 sentences", "sector": "Technology" }
```

---

## 3. Data Models

### 3.1 No new SQL tables (default)

Discovery is **ephemeral + cached**. Results live in Redis (existing Flask-Caching), keyed by `discovery:{profile_signature}:{refinements_hash}`, TTL 15 min — consistent with the existing analysis caches. The "session" (refinement list) lives in client state for the page's lifetime.

### 3.2 Optional future persistence (out of scope, noted for `tasks.md`)

If we later want "save my tailored list," add a thin `SavedDiscovery(user_id, recommendations JSON, created_at)` table. Explicitly deferred — not required by the acceptance criteria.

### 3.3 JSON payload shapes

```jsonc
// POST /discovery/generate request
{ "refinements": ["Exclude EV companies", "Prefer dividend yield over 3%"] }

// response
{
  "recommendations": [
    { "ticker": "MSFT", "company_name": "Microsoft", "rationale": "Durable cloud moat with strong FCF. Fits a long-horizon, growth-tilted profile.", "sector": "Technology" }
  ],
  "generated_from": { "has_profile": true, "refinement_count": 2 }
}
```

---

## 4. Correctness Properties

### P1 — Super prompt is profile-complete or safely generic
`SuperPrompt.build` always produces a runnable prompt. With a completed profile it injects the bounded profile context; with no profile (`profile_ctx == ""`) the template falls back to a sensible generic long-term starter list. The engine never errors or returns nothing solely because onboarding was skipped.

### P2 — Output schema is strictly validated and crash-proof
`DiscoveryParser.parse` is the single choke point. It strips fences, parses JSON, validates each element against the required shape, and on *any* failure returns `[]` instead of raising. Malformed or partial Claude output can degrade the result set but can never crash the route or the page.

### P3 — Discovery is reproducible from client-held session
Because the server is stateless and rebuilds the prompt purely from `(profile, refinements)`, resending the same refinements yields the same prompt (and, via cache, the same result within TTL). No hidden server session state can drift.

### P4 — Refinements are append-only and order-preserving
Each `refine()` appends to the ordered list and resends the whole list; earlier modifiers are never silently dropped, and their order is preserved so "later takes precedence" semantics in the prompt are stable.

### P5 — Refinement count is bounded on both sides
The client caps additions at `MAX_REFINEMENTS` and the server re-sanitizes/caps incoming `refinements`. A user cannot grow the refinement list unboundedly and blow the token budget; excess is rejected/trimmed deterministically.

### P6 — Recommended tickers are valid and routable
Every ticker in the response is non-empty, uppercased, and (where tools confirm) a real symbol. Entries that fail validation are filtered out, so every `DiscoveryCard` can navigate to `/stock/:ticker` without producing a dead route.

### P7 — Generation is idempotent within TTL
Identical `(profile_signature, refinements)` returns the cached payload rather than re-invoking Claude, bounding cost and guaranteeing stable output for a stable request. Only cacheable, non-empty results are cached (errors are never cached).

### P8 — Loading state never strands the UI
`loading` is toggled off in a `finally`, and the grid renders exactly one of: skeletons (in flight), cards (success), or an empty/error state. There is no path where skeleton loaders persist after a request settles.

### P9 — Discovery is read-only with respect to portfolio
Generating or refining recommendations never adds/removes portfolio stocks or mutates the profile. Portfolio mutation only happens through the explicit "Add to portfolio" action on a card, which calls the existing add endpoint.

### P10 — Rationale is bounded
Each `rationale` is truncated/validated to at most two sentences server-side, so a verbose model response cannot produce oversized cards or unbounded payloads.

### P11 — Profile context injection is bounded
The injected profile block is the same bounded, fixed-schema string defined in feature 01 (its Property P11). Combined with the refinement cap (P5), total prompt growth is bounded regardless of profile richness or session length.

### P12 — "Add to list" reuses the one true add path
The shared `AddToListButton` (used on discovery cards, peer rows, and thematic-news cards) calls the same `addStock` → `POST /portfolio/add` flow as the main table. There is no second add implementation to keep in sync, and adding an already-held stock is a safe no-op rather than a duplicate. Every place that lists a stock can therefore add it identically.

---

## 5. Resolved decisions (confirmed)

1. **Server statelessness / client-held session** — confirmed; no discovery session table.
2. **Tools enabled for generation** — confirmed (ticker verification worth the latency).
3. **Persistence of tailored lists** — **deferred** (optional `SavedDiscovery` table noted but out of scope).
4. **Cross-feature dependency** — relies on feature 01's `build_profile_context` / `budget_band`; if 01 ships after, discovery uses the generic fallback (P1) in the interim.
