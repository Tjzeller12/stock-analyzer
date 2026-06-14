# Design — Thematic Global-News Discovery Cards

> **Status:** Design (awaiting alignment) · **Owner:** TBD · **Last updated:** 2026-06-13
>
> Scope: a set of **thematic news cards** on the Discovery page. Each card is a current global-news theme (e.g. *"War in Iran"*, *"AI Bubble"*) with a short explanation and a list of ~5 stocks impacted by/relevant to that theme, each with a one-line rationale. The set is **regenerated on a weekly schedule** (not per request) and every listed stock has the shared **＋ Add to list** button (feature 02's `AddToListButton`).
>
> **Relationship to feature 02:** this lives on the same Discovery page but is a **separate engine** — 02 is *personalized* discovery driven by the user's profile + refinements; this is *global* thematic discovery driven by the week's news, identical for every user. Different trigger (weekly cron vs. on-demand), different persistence (DB-backed weekly snapshot vs. ephemeral cache), so it gets its own folder.
>
> **Reuses:** the AI layer (`AlphaBotClient` with tools for ticker verification + news access), the strict-JSON parse pattern, `StockMaster` ingest (on add), and `AddToListButton`.

---

## 1. Architecture

### 1.1 Generate-on-schedule, serve-from-DB

The expensive AI work (read the week's global news → cluster into themes → pick 5 relevant stocks + rationale per theme) runs **once a week in a background job** and persists the result. At request time the Discovery page just **reads the current week's themes from the DB** — fast, deterministic, AI-free, and identical for all users that week.

```
        ┌──────── Weekly scheduled job (cron / APScheduler) ────────┐
        │  generate_weekly_themes()   (idempotent per ISO week)      │
        │   1. lock(week_key)  (single-flight across workers)        │
        │   2. AlphaBotClient.run_sync(THEMATIC_PROMPT, tools=True)  │
        │        → reads global NEWS_SENTIMENT / top topics          │
        │   3. ThemeParser.parse(raw)  (strict JSON, ≤6 themes,      │
        │        ≤5 deduped valid tickers each, bounded rationale)   │
        │   4. if parse OK → atomic swap: write NewsTheme/ThemeStock │
        │        for week_key; mark active. else → keep last good.   │
        └──────────────────────────────┬────────────────────────────┘
                                        ▼ (DB: NewsTheme + ThemeStock)
┌──────────────────────── SERVER (Flask) ─────────────────────────┐
│  discovery_bp                                                    │
│   └─ GET /discovery/themes  → current week's active themes       │
│        (pure DB read; no Claude call at request time)            │
└──────────────────────────────┬─────────────────────────────────┘
                                ▼
┌──────────────────────── CLIENT (React) ────────────────────────┐
│  DiscoveryPage                                                  │
│    <ThematicNewsSection/>                                       │
│      └─ <ThemeCard/> × N  (title, summary, "updated <date>")    │
│           └─ <ThemeStockRow/> × ≤5  (symbol, rationale,         │
│                 <AddToListButton/>)                             │
└─────────────────────────────────────────────────────────────-─┘
```

### 1.2 Key architectural decisions

- **Weekly snapshot is persisted and keyed by ISO week.** `week_key` (e.g. `2026-W24`) identifies a generation. The job is **idempotent per week**: if themes for the current week already exist, it no-ops. Serving reads only the active week's rows. See **P2**, **P8**.

- **Request-time is AI-free and deterministic.** `GET /discovery/themes` is a plain DB read, so the page loads instantly and every user sees the same themes for the week. Claude is never called on the request path. See **P1**.

- **Generation failure never blanks the page (atomic swap).** New themes are written and marked active only when generation **and** strict parsing succeed. A failed/garbled run leaves the previous good week's themes in place. See **P3**, **P4**.

- **Bounded, validated output.** At most ~6 themes, each with ≤5 deduplicated, valid tickers and a length-bounded rationale and summary. The parser drops anything malformed rather than erroring. See **P5**, **P6**.

- **Single-flight scheduling.** A lock on `week_key` ensures that with multiple web/worker processes, only one generation runs per week (no duplicate themes, no double Claude spend). See **P7**.

- **Scheduling mechanism is pluggable.** Two viable options (decided below): an in-process **APScheduler** job, or an external scheduler (cron / cloud scheduler) hitting an authenticated internal `generate` trigger / CLI command. Either way the generator is the same idempotent function. See §5.

- **Adding a themed stock reuses the one add path.** `ThemeStockRow` uses the shared `AddToListButton` → `addStock` → `POST /portfolio/add`; symbols are ingested into `StockMaster` on add exactly like everywhere else. See **P9**.

### 1.3 Data flow

1. Weekly: scheduler invokes `generate_weekly_themes()` → locks the week → Claude generates themes+stocks → strict parse → atomic write of `NewsTheme`/`ThemeStock` for `week_key` → mark active.
2. `DiscoveryPage` mounts → `GET /discovery/themes` → current active week's themes.
3. `ThemeCard`s render; each `ThemeStockRow` offers `AddToListButton`.

---

## 2. Components and Interfaces

### 2.1 Shared types (client) — `client/src/types.ts` additions

```typescript
export interface ThemeStock {
  symbol: string;
  rationale: string;        // one line, bounded — why this stock relates to the theme
}

export interface NewsTheme {
  id: number;
  title: string;            // "War in Iran", "AI Bubble"
  summary: string;          // short explanation of the theme (bounded)
  stocks: ThemeStock[];     // <= 5, deduped, valid tickers
  week_key: string;         // "2026-W24"
  updated_at: string;       // ISO; UI shows "Updated <date>"
}

export interface ThematicNewsResponse {
  week_key: string;
  themes: NewsTheme[];      // <= ~6, server-ordered
}
```

### 2.2 `useThematicNews` hook — `client/src/hooks/useThematicNews.tsx`

```typescript
export interface UseThematicNews {
  themes: NewsTheme[];
  weekKey: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addToList: (symbol: string) => Promise<void>;   // shared add path
}

export function useThematicNews(): UseThematicNews;
```

### 2.3 Components — `client/src/components/discovery/`

```typescript
// ThematicNewsSection.tsx — section wrapper on DiscoveryPage; renders the ThemeCard grid +
// an empty state if no themes have been generated yet.
interface ThematicNewsSectionProps {
  themes: NewsTheme[];
  onAdd: (symbol: string) => Promise<void>;
}

// ThemeCard.tsx
interface ThemeCardProps {
  theme: NewsTheme;
  onAdd: (symbol: string) => Promise<void>;
}

// ThemeStockRow.tsx
interface ThemeStockRowProps {
  stock: ThemeStock;
  onOpen: (symbol: string) => void;        // → /stock/:symbol
  onAdd: (symbol: string) => Promise<void>; // → shared AddToListButton (feature 02)
}
```

### 2.4 Server — generator, parser, route, schedule

```python
# server/app/services/thematic_news.py
import datetime
from dataclasses import dataclass

MAX_THEMES = 6
MAX_STOCKS_PER_THEME = 5

def current_week_key(now: datetime.datetime | None = None) -> str:
    """Deterministic ISO week key, e.g. '2026-W24', in a fixed timezone."""
    d = (now or datetime.datetime.utcnow()).isocalendar()
    return f"{d.year}-W{d.week:02d}"

@dataclass(frozen=True)
class ParsedTheme:
    title: str; summary: str; stocks: list[tuple[str, str]]   # [(symbol, rationale)]

class ThemeParser:
    @staticmethod
    def parse(text: str) -> list[ParsedTheme]:
        """Strict tolerant parse (same cleanup as analysis.py). Validate each theme:
        non-empty title/summary (bounded), <= MAX_STOCKS_PER_THEME deduped uppercased
        valid tickers each with a bounded rationale. Cap at MAX_THEMES. On total
        failure return [] (caller keeps last good week)."""
        ...

def generate_weekly_themes(force: bool = False) -> str:
    """
    Idempotent per ISO week, single-flight via a lock.
      - week = current_week_key()
      - if active themes exist for `week` and not force → return "noop"
      - acquire lock(f"theme_gen:{week}"); double-check inside lock
      - raw = AlphaBotClient.run_sync(THEMATIC_PROMPT, include_tools=True)
      - themes = ThemeParser.parse(raw)
      - if themes: ATOMIC swap (write NewsTheme/ThemeStock for week, mark active,
            deactivate prior week) else: leave previous active themes untouched
    """
    ...
```

```python
# server/app/routes/discovery.py  (addition)
@discovery_bp.route("/discovery/themes", methods=["GET"])
@login_required
def get_themes():
    """Pure DB read of the active week's themes. No Claude call."""
    week = current_week_key()
    themes = NewsTheme.query.filter_by(week_key=week, is_active=True).order_by(NewsTheme.rank).all()
    if not themes:  # week not generated yet → fall back to most recent active set
        themes = NewsTheme.query.filter_by(is_active=True).order_by(NewsTheme.rank).all()
    return jsonify({"week_key": week, "themes": [t.to_dict() for t in themes]}), 200
```

```python
# Scheduling (option A: in-process APScheduler, registered at app startup)
#   scheduler.add_job(generate_weekly_themes, "cron", day_of_week="mon", hour=6)
# Scheduling (option B: external cron / cloud scheduler → CLI command)
#   flask thematic-news generate     # wraps generate_weekly_themes()
```

```markdown
<!-- server/app/prompts/thematic_news.md (sketch) -->
You are AlphaBot's market-themes editor. Using this week's global financial and world news,
identify up to 6 major themes likely to move specific stocks (e.g. geopolitical conflict,
sector surges, regulatory shifts). For each theme give a short summary and up to 5 publicly
traded stocks most impacted, each with a one-sentence rationale. Verify tickers with tools.

# Output Format
Return ONLY a raw JSON array (no fences, no prose):
[ { "title": "War in Iran",
    "summary": "...",
    "stocks": [ { "symbol": "LMT", "rationale": "Defense contractor likely to see increased orders." } ] } ]
```

---

## 3. Data Models

### 3.1 New tables

```python
class NewsTheme(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    week_key = db.Column(db.String(8), index=True, nullable=False)   # "2026-W24"
    title = db.Column(db.String(120), nullable=False)
    summary = db.Column(db.Text)
    rank = db.Column(db.Integer, default=0)        # display order
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    stocks = db.relationship("ThemeStock", backref="theme",
                             cascade="all, delete-orphan", order_by="ThemeStock.rank")

    def to_dict(self):
        return {"id": self.id, "title": self.title, "summary": self.summary,
                "week_key": self.week_key, "updated_at": self.created_at.isoformat(),
                "stocks": [s.to_dict() for s in self.stocks]}

class ThemeStock(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    theme_id = db.Column(db.Integer, db.ForeignKey("news_theme.id"), nullable=False)
    symbol = db.Column(db.String(12), nullable=False)
    rationale = db.Column(db.String(280))
    rank = db.Column(db.Integer, default=0)
    def to_dict(self):
        return {"symbol": self.symbol, "rationale": self.rationale}
```

The weekly snapshot is small and bounded (≤6 themes × ≤5 stocks). Old weeks can be kept for history or pruned; only `is_active` rows for the current `week_key` are served.

### 3.2 JSON payload shapes

```jsonc
// GET /discovery/themes response
{
  "week_key": "2026-W24",
  "themes": [
    { "id": 1, "title": "War in Iran", "summary": "Escalating conflict raises defense and energy exposure.",
      "week_key": "2026-W24", "updated_at": "2026-06-08T06:00:00",
      "stocks": [
        { "symbol": "LMT", "rationale": "Defense contractor likely to see increased orders." },
        { "symbol": "XOM", "rationale": "Oil major benefits from supply-driven price spikes." }
      ] },
    { "id": 2, "title": "AI Bubble", "summary": "Renewed surge in AI names after strong earnings.",
      "week_key": "2026-W24", "updated_at": "2026-06-08T06:00:00",
      "stocks": [ { "symbol": "NVDA", "rationale": "Leading AI accelerator demand." } ] }
  ]
}
```

---

## 4. Correctness Properties

### P1 — Serving is AI-free and deterministic
`GET /discovery/themes` reads persisted rows only; it never calls Claude. The page loads fast and every user sees the same themes for a given week, independent of model latency or availability.

### P2 — Generation is idempotent per ISO week
Running `generate_weekly_themes()` when the current week already has active themes is a no-op (unless `force`). Re-invocations (retries, multiple schedulers) never create duplicate themes for the same week.

### P3 — Generation failure preserves the last good themes
New themes become active only if generation and strict parsing both succeed. A failed or unparseable run leaves the previously active week's themes untouched, so the page never goes blank because a weekly job failed.

### P4 — Theme activation is atomic
Writing a new week's themes and flipping `is_active` happens in one transaction. A reader never observes a half-written week (some themes from the new run, some from the old); they see either the complete old set or the complete new set.

### P5 — Theme and stock counts are bounded
At most `MAX_THEMES` themes are stored/served, each with at most `MAX_STOCKS_PER_THEME` stocks. The model can't flood the page with arbitrarily many themes or tickers.

### P6 — Stocks are deduped, valid, and rationale-bounded
Within a theme, tickers are uppercased, deduplicated, and validated (verifiable symbols), and each rationale is length-capped. Malformed entries are dropped during parse rather than rendered.

### P7 — Generation is single-flight across workers
A lock on `week_key` ensures only one generation runs per week even with multiple processes, preventing duplicate work and double Claude spend.

### P8 — Week boundaries are deterministic
`current_week_key` uses ISO week in a fixed timezone, so the "current week" is unambiguous and the same for generation and serving — no off-by-one between when a theme is written and when it's read.

### P9 — Adding a themed stock reuses the one add path
`ThemeStockRow`'s ＋ button uses the shared `AddToListButton` → existing `addStock`/`POST /portfolio/add`, with `StockMaster` ingest on add. Adding from a theme card is identical to adding anywhere else and is a safe no-op if already held (shared with feature 02's P12).

### P10 — Empty state is graceful
Before the first generation (or if no active themes exist), `GET /discovery/themes` returns an empty list and the section renders a friendly placeholder rather than an error.

---

## 5. Resolved / open decisions

1. **Own folder, lives on the Discovery page** — separate engine from personalized discovery (02). *(Resolved.)*
2. **Generate weekly, serve from DB** with atomic swap + per-week idempotency + single-flight lock. *(Resolved.)*
3. **Scheduling mechanism** — APScheduler in-process (simplest, no new infra) vs. external cron/cloud scheduler hitting a CLI command (more robust for multi-instance deploys). *Leaning external cron → `flask thematic-news generate` for clean single-flight in containerized deploys; confirm with the deploy model.*
4. **History retention** — keep prior weeks for a "past themes" view, or prune. *(Open — default: keep, only serve active.)*
5. **Theme count / cadence** — up to 6 themes, weekly. Cadence could later be configurable. *(Resolved default.)*
