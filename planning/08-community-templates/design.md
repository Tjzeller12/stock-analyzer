# Design — Community Analysis Templates & Saveable Preferences

> **Status:** After 06 · **Owner:** Thomas · **Last updated:** 2026-08-27
>
> Scope: let users **save their analysis configuration** (radar equations + normalization + scope + active axes + visible columns) as a named, reusable template; ship **one high-quality default per investor `risk_tag`** (Conservative / Balanced / Growth / Aggressive) plus a clearly labeled Balanced fallback; add a **"Save Current View as Template"** action; make **applying a template instantly update both the AG Grid column visibility and the radar/precedence state**; **auto-apply the profile-matched default until the user has their own templates**; and build the **community** layer — public templates with creator attribution, **stars/likes**, and — once brokerage data exists — real-world performance for credibility.
>
> The defaults are the product. Placeholder copy ("Warren Buffett Value", "High-Risk Tech") is not acceptable. Each seeded template needs a written thesis, real `StockMaster` fields, and a ranking check against fixture stocks so it is genuinely useful for that investor type.
>
> **Two independent performance/credibility signals:** (1) **stars** — social popularity (how many users liked a template), and (2) **verified return** — real brokerage-backed performance (feature 10). They are surfaced side by side and are sortable independently; stars are available immediately, verified return only when brokerage data exists.
>
> **Reuses / extends:** the `AnalysisTemplate` model already exists (`name`, `description`, `creator_id`, `equations` JSON, `is_default`). Feature 01 already maps `risk_tag` → a suggested `RadarTemplate` in `personalization.suggest_default_template`. This feature **promotes those four presets into seeded, reviewed defaults** (single source of truth) and adds CRUD, community, and the apply policy. Depends on feature 06 (`visible_columns` registry).

---

## 1. Architecture

### 1.1 Where this fits

`AnalysisTemplate` is half-built: it stores `equations` but not the rest of a `RadarTemplate` (normalization, scope) nor the column-visibility prefs introduced in feature 06. Applying a template must update **two** client states: the radar `activeTemplate` and the table `visibleColumns`. So this feature (a) extends the stored config to be complete, (b) adds CRUD + seeding endpoints, and (c) wires a selector that applies a template atomically to both states.

```
┌──────────────────────── CLIENT (React) ────────────────────────┐
│  ControlPanel / StockTable                                      │
│    <TemplateSelector/>      ── defaults ▸ mine ▸ community       │
│    [Save Current View as Template]  → name + description modal   │
│      useTemplateManager()                                       │
│        applyTemplate(t):                                        │
│          setActiveTemplate(t.radar)          (radar/precedence)  │
│          setVisibleColumns(t.columns)        (AG Grid visibility)│
│        saveCurrentView(name, desc, radar, columns)              │
│            │ GET/POST/PUT/DELETE /templates                     │
└────────────┼────────────────────────────────────────────────-─┘
             ▼
┌──────────────────────── SERVER (Flask) ─────────────────────────┐
│  templates_bp                                                    │
│   ├─ GET    /templates           defaults ∪ mine ∪ public        │
│   ├─ POST   /templates           create (owner = current user)   │
│   ├─ PUT    /templates/<id>      update (owner only)             │
│   ├─ DELETE /templates/<id>      delete (owner only, not default)│
│   └─ POST   /templates/<id>/share  toggle is_public (owner only) │
│                                                                  │
│  seed_default_templates()  (idempotent, like seed_filters)       │
│  AnalysisTemplate (extended: config JSON, is_public, …)          │
└──────────────────────────────────────────────────────────────--┘
```

### 1.2 Key architectural decisions

- **Store the *complete* config, not just equations.** Extend `AnalysisTemplate` with a `config` JSON holding the full `RadarTemplate` (`equations`, `normalization_method`, `scope`) plus `visible_columns`. The legacy `equations` column is migrated into `config.radar.equations`. This is what lets "apply" restore the exact view. See **P3**.

- **Apply is a non-destructive client state swap.** Applying a template sets `activeTemplate` and `visibleColumns`; it does **not** delete or overwrite the user's saved templates, and the user's current unsaved working config is simply replaced in memory (they can re-apply their own template to get it back). See **P2**.

- **Defaults are seeded idempotently, one per `risk_tag`, and are read-only.** `seed_default_templates()` runs at startup like `seed_filters()`. Each default has `profile_risk_tag` in `Conservative | Balanced | Growth | Aggressive` so `suggest_default_template` is a lookup into the seed, not a second parallel dict. Defaults cannot be edited or deleted — applying one that you want to tweak **clones** it into a new owned template. See **P1**, **P5**, **P6**.

- **Quality bar: defaults must actually discriminate.** Before ship, each default has (a) a one-paragraph thesis (who it is for, which axes, why those columns), (b) equations using real `StockMaster` fields only, (c) a fixture ranking test (e.g. a high-quality compounder outranks a leveraged speculative name on Conservative). Cute labels without working math do not ship. See **P16**.

- **First-run apply is automatic; owned templates win thereafter.** If the user has a completed profile and **zero owned templates**, MainPage applies the matching default (incomplete profile → Balanced). If they have any owned template, use last-applied / most recently updated owned template. Changing the investor profile later does **not** swap the active view. This is the allowed exception to feature 01's P7. See **P15**.

- **Ownership and visibility are enforced server-side.** Users can only edit/delete templates they own. Public templates are visible to everyone but read-only to non-owners; "using" someone's public template **clones** it rather than mutating the original. See **P4**, **P7**.

- **Community performance is verified-only and deferred.** The community page can list public templates with creator attribution now, but *performance* numbers ("how people perform IRL") must come from verified brokerage holdings (feature 10) — never self-reported. The schema reserves the link; the UI shows performance only when real data backs it. See **P8**.

- **Stars are a denormalized social signal.** A `TemplateStar(user_id, template_id)` join table records likes (one per user per template). The template carries a denormalized `star_count` kept in sync with the join table so the community list can sort by popularity cheaply, without a `COUNT(*)` per row. Starring is idempotent (re-starring is a no-op) and a user can unstar. See **P11**, **P12**.

### 1.3 Data flow

1. On load, `useTemplateManager` `GET /templates` → `{ defaults, mine, community }`.
2. User picks one in `TemplateSelector` → `applyTemplate` swaps radar + columns in one update.
3. "Save Current View as Template" opens a name/description modal → `POST /templates` with the current `RadarTemplate` + `visibleColumns`.
4. Edit/delete/share act on owned templates only; sharing toggles `is_public`.

---

## 2. Components and Interfaces

### 2.1 Shared types (client) — `client/src/types.ts` additions

```typescript
export interface AnalysisTemplateConfig {
  radar: RadarTemplate;           // equations + normalization_method + scope + axes
  visible_columns: string[];      // column ids from feature 06's registry
}

export interface AnalysisTemplateDTO {
  id: number;
  name: string;
  description: string;
  config: AnalysisTemplateConfig;
  is_default: boolean;
  is_public: boolean;
  is_owner: boolean;              // computed server-side for the current user
  creator_name?: string;         // for community attribution
  // --- social signal ---
  star_count: number;            // denormalized like count
  is_starred: boolean;           // whether the current user has starred it
  // --- verified performance (feature 10), null until backed by brokerage data ---
  verified_return_pct?: number | null;
}

export type CommunitySort = "stars" | "verified_return" | "newest";

export interface TemplateLibrary {
  defaults: AnalysisTemplateDTO[];
  mine: AnalysisTemplateDTO[];
  community: AnalysisTemplateDTO[];   // ordered by the requested CommunitySort
}
```

### 2.2 `useTemplateManager` hook — `client/src/hooks/useTemplateManager.tsx`

```typescript
export interface UseTemplateManager {
  library: TemplateLibrary | null;
  loading: boolean;
  error: string | null;

  refresh: (sort?: CommunitySort) => Promise<void>;  // community sort: stars | verified_return | newest
  toggleStar: (id: number) => Promise<void>;         // optimistic; idempotent on server (P11)
  applyTemplate: (t: AnalysisTemplateDTO) => void;   // swaps radar + columns (P2)
  saveCurrentView: (name: string, description: string,
                    radar: RadarTemplate, visibleColumns: string[]) => Promise<void>;
  updateTemplate: (id: number, patch: Partial<{name: string; description: string;
                    config: AnalysisTemplateConfig}>) => Promise<void>;  // owner only
  deleteTemplate: (id: number) => Promise<void>;     // owner only, not default
  toggleShare: (id: number, isPublic: boolean) => Promise<void>;
  cloneTemplate: (t: AnalysisTemplateDTO) => Promise<AnalysisTemplateDTO>; // for default/community
}

// applyTemplate is wired to MainPage's setActiveTemplate + feature 06's setVisibleColumns.
export function useTemplateManager(): UseTemplateManager;
```

### 2.3 Components

```typescript
// client/src/components/common/TemplateSelector.tsx
interface TemplateSelectorProps {
  library: TemplateLibrary;
  activeTemplateId?: number;
  communitySort: CommunitySort;
  onApply: (t: AnalysisTemplateDTO) => void;
  onSave: () => void;            // opens SaveTemplateModal
  onDelete: (id: number) => void;
  onShare: (id: number, isPublic: boolean) => void;
  onToggleStar: (id: number) => void;          // ★ like / unlike
  onSortChange: (sort: CommunitySort) => void; // sort community by stars | return | newest
}
// Sections: "Starter Templates" (defaults), "My Templates", "Community" (social feed:
// each card shows ★ star_count + a verified-return badge when available; sortable).

// client/src/components/common/StarButton.tsx
interface StarButtonProps {
  count: number;
  active: boolean;            // current user starred
  onToggle: () => void;
  disabled?: boolean;
}

// client/src/components/common/SaveTemplateModal.tsx
interface SaveTemplateModalProps {
  initialName?: string;
  onSave: (name: string, description: string) => void;
  onClose: () => void;
}
```

### 2.4 Server — model extension, routes, seeding

```python
# server/app/models.py  (AnalysisTemplate extensions)
class AnalysisTemplate(db.Model):
    # ... existing: id, name, description, creator_id, is_default, time_created ...
    equations = db.Column(db.JSON, nullable=False)        # legacy; migrated into config.radar
    config    = db.Column(db.JSON)                         # { radar: RadarTemplate, visible_columns: [...] }
    is_public = db.Column(db.Boolean, default=False)
    star_count = db.Column(db.Integer, default=0, index=True)   # denormalized like count (P12)

    def to_dict(self, current_user_id=None, starred_ids: set | None = None):
        return {
            "id": self.id, "name": self.name, "description": self.description,
            "config": self.config or {"radar": {"equations": self.equations}, "visible_columns": []},
            "is_default": self.is_default, "is_public": self.is_public,
            "is_owner": bool(current_user_id and self.creator_id == current_user_id),
            "creator_name": self.creator.username if self.creator and self.is_public else None,
            "star_count": self.star_count or 0,
            "is_starred": bool(starred_ids and self.id in starred_ids),
            "verified_return_pct": None,   # populated from PerformanceSnapshot (feature 10) when available
        }


class TemplateStar(db.Model):
    """One row per (user, template) like. Source of truth; star_count is denormalized from it."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(32), db.ForeignKey("user.id"), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey("analysis_template.id"), nullable=False)
    time_created = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "template_id"),)   # one star per user (P11)
```

```python
# server/app/routes/templates.py
templates_bp = Blueprint("templates", __name__)

@templates_bp.route("/templates", methods=["GET"])
@login_required
def list_templates():
    user = get_current_user()
    sort = request.args.get("sort", "stars")   # stars | verified_return | newest
    starred_ids = {s.template_id for s in TemplateStar.query.filter_by(user_id=user.id).all()}

    defaults  = AnalysisTemplate.query.filter_by(is_default=True).all()
    mine      = AnalysisTemplate.query.filter_by(creator_id=user.id).all()
    community_q = AnalysisTemplate.query.filter(AnalysisTemplate.is_public.is_(True),
                                                AnalysisTemplate.creator_id != user.id)
    community = _apply_community_sort(community_q, sort).all()   # ORDER BY star_count desc, etc.

    return jsonify({
        "defaults":  [t.to_dict(user.id, starred_ids) for t in defaults],
        "mine":      [t.to_dict(user.id, starred_ids) for t in mine],
        "community": [t.to_dict(user.id, starred_ids) for t in community],
    }), 200


@templates_bp.route("/templates/<int:id>/star", methods=["POST", "DELETE"])
@login_required
def star_template(id):
    """POST = star, DELETE = unstar. Both idempotent; star_count stays in sync (P11, P12)."""
    user = get_current_user()
    tmpl = AnalysisTemplate.query.get_or_404(id)
    existing = TemplateStar.query.filter_by(user_id=user.id, template_id=id).first()

    if request.method == "POST" and not existing:
        db.session.add(TemplateStar(user_id=user.id, template_id=id))
        tmpl.star_count = (tmpl.star_count or 0) + 1
    elif request.method == "DELETE" and existing:
        db.session.delete(existing)
        tmpl.star_count = max(0, (tmpl.star_count or 0) - 1)
    db.session.commit()                       # no-op commit if already in desired state
    return jsonify({"star_count": tmpl.star_count, "is_starred": request.method == "POST"}), 200

@templates_bp.route("/templates", methods=["POST"])
@login_required
def create_template():
    user = get_current_user()
    body = request.json or {}
    ok, err = validate_template_config(body.get("config"))   # shape + bounds
    if not ok:
        return jsonify({"error": err}), 400
    t = AnalysisTemplate(name=body["name"][:100], description=(body.get("description") or "")[:255],
                         creator_id=user.id, is_default=False, is_public=False,
                         config=body["config"], equations=body["config"]["radar"]["equations"])
    db.session.add(t); db.session.commit()
    return jsonify(t.to_dict(user.id)), 201

# PUT /templates/<id>, DELETE /templates/<id>, POST /templates/<id>/share
#   all guarded: must be owner; defaults are immutable/undeletable.
```

```python
# server/app/services/template_seed.py  (idempotent, called at startup like seed_filters)
# One default per InvestorProfile.risk_tag. Names/equations below are sketches —
# replace with the reviewed thesis + ranking-tested config before seed ships.
DEFAULT_TEMPLATES = [
    {
        "name": "Stability First",
        "profile_risk_tag": "Conservative",
        "description": "Favors balance-sheet strength, modest valuation, and durable cash return over growth.",
        "config": { "radar": { ... }, "visible_columns": [...] },
    },
    {
        "name": "Balanced Core",
        "profile_risk_tag": "Balanced",
        "description": "Even mix of valuation, growth, and stability — the fallback when profile is incomplete.",
        "config": { "radar": { ... }, "visible_columns": [...] },
    },
    {
        "name": "Growth Tilt",
        "profile_risk_tag": "Growth",
        "description": "Weights earnings/revenue growth and reinvestment returns; valuation via PEG/sales, not deep value.",
        "config": { "radar": { ... }, "visible_columns": [...] },
    },
    {
        "name": "High Conviction Growth",
        "profile_risk_tag": "Aggressive",
        "description": "Sector-relative growth and momentum; accepts higher volatility for upside.",
        "config": { "radar": { ... }, "visible_columns": [...] },
    },
]

def seed_default_templates():
    for spec in DEFAULT_TEMPLATES:
        if not AnalysisTemplate.query.filter_by(name=spec["name"], is_default=True).first():
            db.session.add(AnalysisTemplate(is_default=True, creator_id=None, **_to_columns(spec)))
    db.session.commit()

def default_for_risk_tag(risk_tag: str | None) -> AnalysisTemplate:
    """Balanced if tag missing/unknown. Used by suggest_default_template + first-run apply."""
    ...
```

`personalization.suggest_default_template` becomes a thin wrapper over `default_for_risk_tag` so feature 01 tests keep passing against the seeded configs.

---

## 3. Data Models

### 3.1 `AnalysisTemplate` (extended)

| Column | Status | Notes |
|---|---|---|
| `id`, `name`, `description`, `creator_id`, `is_default`, `time_created` | existing | unchanged |
| `equations` JSON | existing | retained for back-compat; mirrors `config.radar.equations` |
| `config` JSON | **new** | `{ radar: RadarTemplate, visible_columns: string[] }` — the full applyable view |
| `is_public` Boolean | **new** | default `False`; community visibility flag |
| `star_count` Integer | **new** | denormalized like count, indexed for sort-by-popular |

New `TemplateStar(user_id, template_id, time_created)` join table with a `UNIQUE(user_id, template_id)` constraint is the source of truth for likes; `star_count` is kept in sync with it.

Migration: add `config` + `is_public` + `star_count`; create `template_star`; backfill `config` from existing `equations` for any rows. Seed defaults idempotently.

### 3.2 JSON payload shapes

```jsonc
// POST /templates request
{ "name": "Tech Growth Screener", "description": "Ignores dividends, weights FCF + revenue growth.",
  "config": { "radar": { "name": "Tech Growth", "normalization_method": "min-max", "scope": "sector",
                         "equations": { "Growth": "...", "Efficiency": "..." } },
              "visible_columns": ["symbol","price","market_cap","rev_growth_qoq","free_cash_flow"] } }

// GET /templates response → TemplateLibrary (defaults / mine / community arrays of AnalysisTemplateDTO)
```

---

## 4. Correctness Properties

### P1 — Default seeding is an idempotent no-op when present
`seed_default_templates()` inserts each default only if a default of that name doesn't already exist. Running it on every startup is safe and cheap; it never duplicates defaults and never overwrites a user's edits.

### P2 — Applying a template is non-destructive
Applying a template swaps the in-memory radar + column state only. It never deletes, overwrites, or mutates any saved template (the user's or anyone's). The previously active config can be restored by re-applying its template.

### P3 — A saved template fully restores the view
`config` captures everything needed to reproduce the analysis view — radar equations, normalization, scope, active axes, and visible columns — so applying a saved template reproduces both the radar/precedence state and the exact AG Grid column layout. The "instantly updates grid visibility and precedence" criterion is satisfied by a single apply.

### P4 — Ownership is enforced on every mutation
`PUT`, `DELETE`, and `share` succeed only when the current user is the template's `creator_id`. A user can never edit or delete another user's template, regardless of public visibility. Unauthorized mutations return `403`.

### P5 — Default templates are immutable and undeletable
Templates with `is_default=True` cannot be edited or deleted via the API. A user who wants to modify a default must clone it, which produces a new owned template, leaving the default intact for everyone.

### P6 — Cloning produces an independent owned copy
Cloning a default or community template creates a new row owned by the current user with `is_default=False`, `is_public=False`. Subsequent edits to the clone never affect the source template.

### P7 — Public templates are read-only to non-owners
Community templates appear in the `community` list and can be applied/cloned by anyone, but only the owner can edit, delete, or toggle their visibility. "Using" a community template clones it; it never mutates the shared original.

### P8 — Community performance is verified-only
Any performance/credibility figure shown next to a community template is derived exclusively from verified brokerage holdings (feature 10), never self-reported. Until such data exists for a creator, no performance number is displayed — the platform never implies returns it cannot substantiate.

### P9 — Config is validated before persistence
`validate_template_config` rejects malformed configs (missing radar equations, unknown column ids, out-of-range fields) with a `400`, so a stored template is always applyable and can't corrupt the client state when later loaded.

### P10 — Template names/descriptions are bounded
`name` (≤100) and `description` (≤255) are length-capped to match the schema, preventing overflow and keeping the selector UI tidy.

### P11 — Starring is idempotent and one-per-user
The `UNIQUE(user_id, template_id)` constraint guarantees a user can star a template at most once. Starring an already-starred template (or unstarring an unstarred one) is a no-op that leaves the count unchanged. Double-clicks and retried requests can't inflate the count.

### P12 — `star_count` is consistent with the star rows
`star_count` is always incremented/decremented in the same transaction that inserts/deletes the `TemplateStar` row, so the denormalized count equals `COUNT(*)` of stars for that template. The count never drifts from the source-of-truth join table, and never goes negative.

### P13 — Stars and verified return are independent signals
The community list can be sorted by stars, by verified return, or by recency, and the two performance signals are computed and displayed independently. A template with many stars but no brokerage-verified return shows its star count and simply omits a return badge — popularity is never conflated with realized performance.

### P14 — Starring is read-only with respect to template config
Liking/unliking a template never mutates its `config`, ownership, or visibility. A star is purely a social annotation; it can't alter what the template does or who controls it.

### P15 — Profile default applies only until the user has their own set
On MainPage load: completed profile + zero owned templates → apply `default_for_risk_tag(profile.risk_tag)`. Incomplete/unknown profile → Balanced default. Once the user owns at least one template (saved or cloned), the active view is last-applied / most recently updated owned template. Updating the investor profile later never silently swaps the active template.

### P16 — Seeded defaults are reviewed, not placeholders
Each default has a written thesis, uses only real `StockMaster` fields, and passes a fixture ranking test for that `risk_tag`. A template that cannot separate a quality name from a speculative one on Conservative (or the inverse on Aggressive) does not ship.

---

## 5. Resolved decisions (confirmed)

1. **Store full config** (`radar` + `visible_columns`) in a new `config` JSON; retain `equations` for back-compat.
2. **Four idempotently-seeded read-only defaults, one per `risk_tag`**; editing a default clones it. Quality review is part of definition of done.
3. **First-run auto-apply of the profile match; owned templates always win after that** (feature 01 P7 exception, documented there).
4. **Ownership-guarded CRUD; public = read-only to non-owners; "use" = clone.**
5. **Community performance gated on verified brokerage data** (feature 10) — schema link reserved, UI shows nothing until real data exists.
6. **Stars** (`TemplateStar` + denormalized `star_count`) provide a social popularity signal; the community feed is sortable by **stars / verified return / newest**. Stars and verified return are two independent credibility signals shown side by side.
