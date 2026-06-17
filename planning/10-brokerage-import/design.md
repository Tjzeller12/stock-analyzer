# Design — Brokerage Portfolio Import (Stretch)

> **Status:** Design (stretch / exploratory) · **Owner:** TBD · **Last updated:** 2026-06-13
>
> Scope: let a user connect a brokerage (Robinhood, etc.) and pull in their **real holdings** read-only. Surface those holdings in a second table identical to the MainPage table (with per-holding radar charts and metrics), show their real-world **performance**, and feed a **community** section where users can see how people actually perform IRL alongside the analysis templates they used — giving credibility to those templates (ties to feature 08).
>
> **Reuses:** `StockTable`/radar/score engine for the holdings view, `StockMaster` ingest for holdings' symbols, the hardened auth + secret handling from feature 09, and the community template surface from feature 08.

---

## 1. Architecture

### 1.1 Approach: aggregator, not scraping

Robinhood has no official public API, and screen-scraping/credential capture is a security and ToS liability. The design uses a **brokerage aggregator** that offers OAuth-style, read-only investment connections across many brokerages (e.g. **SnapTrade** or **Plaid Investments**). The user authenticates with their broker through the aggregator's hosted flow; we receive read-only holdings, never their broker password. This isolates us from per-broker quirks and keeps credentials out of our system.

```
┌──────────────────────── CLIENT (React) ────────────────────────┐
│  /portfolio (or MainPage "My Holdings" tab)                     │
│    [Connect brokerage] → aggregator hosted link flow            │
│    <HoldingsTable/>   ── same grid as StockTable + cost/PnL     │
│       per-row radar (reuses score engine)                       │
│    <PerformanceSummary/>  ── total value, cost basis, return    │
│  Community page                                                 │
│    <CommunityLeaderboard/> ── public, verified performance +    │
│       the AnalysisTemplate each user ran (feature 08)           │
└────────────┼────────────────────────────────────────────────-─┘
             ▼
┌──────────────────────── SERVER (Flask) ─────────────────────────┐
│  brokerage_bp                                                    │
│   ├─ POST /brokerage/connect/start    → aggregator link token    │
│   ├─ POST /brokerage/connect/callback → store connection (enc.)  │
│   ├─ POST /brokerage/sync             → pull holdings (idempotent)│
│   ├─ GET  /brokerage/holdings         → holdings + performance    │
│   └─ POST /brokerage/disconnect       → purge credentials         │
│                                                                  │
│  services/brokerage_service.py  (aggregator adapter, encrypted)  │
│     sync_holdings(connection) -> reconciled Holding rows         │
│     compute_performance(user) -> PerformanceSummary              │
│  BrokerageConnection · Holding · PerformanceSnapshot (DB)        │
│  ingest holdings' symbols → StockMaster (reuse stock_manager)    │
└──────────────────────────────────────────────────────────────--┘
```

### 1.2 Key architectural decisions

- **Read-only, aggregator-mediated connections.** We request only holdings/positions scope; we never obtain trading permission or the broker password. Tokens are issued by the aggregator and stored **encrypted at rest**. See **P1**, **P2**.

- **Holdings are a reconciled snapshot, synced idempotently.** Each `sync` replaces the user's holdings with the latest reconciled set (upsert by `(connection, symbol)`, delete positions no longer present). Re-syncing is safe and convergent — no duplicate or orphaned positions. See **P3**.

- **Performance is computed from broker-provided cost basis, never self-reported.** Return = current value vs. broker cost basis. This is the credibility backbone: community performance can only come from a verified connection, never a number a user typed. See **P5**, **P8**.

- **Holdings reuse the existing analysis stack.** Each holding's symbol is ingested into `StockMaster` (same path the portfolio uses), so the holdings table gets the same radar charts, metrics, and scoring as the main table for free. The `HoldingsTable` is the existing grid plus shares/cost/PnL columns. See **P6**.

- **Private by default; sharing is explicit and minimal.** Holdings are private. Appearing on the community leaderboard is an explicit opt-in that shares **performance + the template used**, optionally anonymized, and never raw account details or dollar balances unless the user chooses. See **P7**, **P9**.

- **Disconnect is a hard purge.** Disconnecting removes the stored connection/credentials and (per user choice) the imported holdings. See **P10**.

### 1.3 Data flow

1. User clicks "Connect brokerage" → `connect/start` returns an aggregator link token → hosted flow → `connect/callback` stores an encrypted `BrokerageConnection`.
2. `sync` pulls positions, ingests symbols into `StockMaster`, reconciles `Holding` rows, writes a `PerformanceSnapshot`.
3. `GET /brokerage/holdings` returns holdings + performance; the UI renders the second table with radars.
4. Opt-in publishes performance + template to the community leaderboard.

---

## 2. Components and Interfaces

### 2.1 Shared types (client) — `client/src/types.ts` additions

```typescript
export interface Holding {
  symbol: string;
  quantity: number;          // may be fractional (broker-reported)
  avg_cost: number;          // per-share cost basis from broker
  current_price: number;
  market_value: number;      // quantity * current_price
  cost_basis: number;        // quantity * avg_cost
  unrealized_pnl: number;    // market_value - cost_basis
  unrealized_pnl_pct: number;
}

export interface PerformanceSummary {
  total_value: number;
  total_cost_basis: number;
  total_return: number;
  total_return_pct: number;
  last_synced: string | null;   // ISO; UI flags staleness
}

export interface BrokerageConnectionStatus {
  connected: boolean;
  brokerage_name?: string;
  last_synced?: string | null;
}
```

### 2.2 `useBrokerageManager` hook — `client/src/hooks/useBrokerageManager.tsx`

```typescript
export interface UseBrokerageManager {
  status: BrokerageConnectionStatus;
  holdings: Holding[];
  performance: PerformanceSummary | null;
  loading: boolean;
  error: string | null;

  startConnect: () => Promise<void>;   // → aggregator hosted flow
  sync: () => Promise<void>;           // pull latest holdings
  disconnect: () => Promise<void>;     // purge credentials
  publishToCommunity: (templateId: number, anonymize: boolean) => Promise<void>;
}

export function useBrokerageManager(): UseBrokerageManager;
```

### 2.3 Components

```typescript
// client/src/components/common/HoldingsTable.tsx
interface HoldingsTableProps {
  holdings: Holding[];
  radarScores: Record<string, Record<string, number>>;  // reuse score engine
  activeTemplate: RadarTemplate;
  onRowClick: (symbol: string) => void;
  // adds columns: Quantity | Avg Cost | Market Value | Unrealized P/L ($ / %)
}

// client/src/components/common/PerformanceSummary.tsx
interface PerformanceSummaryProps { performance: PerformanceSummary; }

// client/src/components/community/CommunityLeaderboard.tsx
interface CommunityLeaderboardProps {
  entries: Array<{ display_name: string; return_pct: number;
                   template: AnalysisTemplateDTO; verified: boolean }>;
}
```

### 2.4 Server — service + routes (sketch)

```python
# server/app/services/brokerage_service.py
def sync_holdings(connection) -> list["Holding"]:
    """Pull positions from the aggregator, ingest each symbol into StockMaster,
    upsert Holding rows by (connection_id, symbol), delete positions no longer
    present. Idempotent and convergent."""
    ...

def compute_performance(user) -> dict:
    """Aggregate holdings into total value / cost basis / return using
    broker-provided cost basis only. Writes a PerformanceSnapshot."""
    ...

# routes: connect/start, connect/callback, sync, holdings, disconnect, publish
# All @login_required; tokens encrypted via a KMS/Fernet key from env (feature 09 hygiene).
```

---

## 3. Data Models

### 3.1 New tables

```python
class BrokerageConnection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(32), db.ForeignKey("user.id"), nullable=False)
    provider = db.Column(db.String(40))                 # aggregator/brokerage id
    brokerage_name = db.Column(db.String(80))
    access_token_enc = db.Column(db.LargeBinary)        # encrypted at rest, never returned
    status = db.Column(db.String(20), default="active") # active | error | revoked
    last_synced = db.Column(db.DateTime)

class Holding(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    connection_id = db.Column(db.Integer, db.ForeignKey("brokerage_connection.id"), nullable=False)
    symbol = db.Column(db.String(12), nullable=False)
    quantity = db.Column(db.Float)
    avg_cost = db.Column(db.Float)
    __table_args__ = (db.UniqueConstraint("connection_id", "symbol"),)

class PerformanceSnapshot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(32), db.ForeignKey("user.id"), nullable=False)
    total_value = db.Column(db.Float)
    total_cost_basis = db.Column(db.Float)
    total_return_pct = db.Column(db.Float)
    is_public = db.Column(db.Boolean, default=False)    # community opt-in
    template_id = db.Column(db.Integer, db.ForeignKey("analysis_template.id"), nullable=True)
    captured_at = db.Column(db.DateTime, default=datetime.utcnow)
```

Live prices/metrics come from `StockMaster` (symbols ingested on sync); only quantity + cost basis are brokerage-specific.

### 3.2 JSON payload shapes

```jsonc
// GET /brokerage/holdings response
{
  "status": { "connected": true, "brokerage_name": "Robinhood", "last_synced": "2026-06-13T22:00:00" },
  "holdings": [ { "symbol": "AAPL", "quantity": 10, "avg_cost": 150.0, "current_price": 210.0,
                  "market_value": 2100.0, "cost_basis": 1500.0, "unrealized_pnl": 600.0, "unrealized_pnl_pct": 40.0 } ],
  "performance": { "total_value": 2100.0, "total_cost_basis": 1500.0, "total_return": 600.0,
                   "total_return_pct": 40.0, "last_synced": "2026-06-13T22:00:00" }
}
```

---

## 4. Correctness Properties

### P1 — Connections are read-only
The requested scope is positions/holdings only. The system has no capability to place, modify, or cancel trades, so a compromised token cannot move a user's money.

### P2 — Brokerage credentials are encrypted and never client-exposed
Aggregator tokens are stored encrypted at rest and are never serialized into any API response or client payload. `to_dict`/holdings responses contain no token material.

### P3 — Sync is idempotent and convergent
Running `sync` any number of times converges to the broker's current positions: existing positions are updated in place, new ones inserted, and vanished ones removed. There are never duplicate `(connection, symbol)` rows or stale orphaned positions.

### P4 — Per-symbol failures don't fail the whole sync
A symbol the analysis stack can't resolve (foreign listing, unsupported instrument) is recorded as a holding with whatever data exists and skipped for enrichment, rather than aborting the entire sync. Partial data degrades gracefully.

### P5 — Performance is broker-sourced, not self-reported
Returns are computed from broker-provided quantity and cost basis against live prices. No user-entered number contributes to a performance figure, which is what makes the community leaderboard credible.

### P6 — Holdings reuse the existing analysis consistently
Each holding's symbol is ingested into `StockMaster`, so radar scores/metrics for a holding are computed by the exact same engine and template as the main portfolio table. The two tables can't show divergent analysis for the same symbol.

### P7 — Holdings are private by default
Imported holdings and performance are visible only to the owning user unless they explicitly opt in to publishing. Nothing about a user's account is exposed to the community without an affirmative action.

### P8 — Community performance requires a verified connection
A leaderboard entry can only be created from a real, synced brokerage connection; there is no path to publish a performance number without verified holdings backing it.

### P9 — Sharing is minimal and controllable
Publishing exposes performance percentage + the template used (optionally under an anonymized display name); raw dollar balances and account identifiers are never published unless the user explicitly chooses to include them.

### P10 — Disconnect purges credentials
Disconnecting deletes the stored (encrypted) connection token and marks the connection revoked; per the user's choice, imported holdings are also removed. No usable credential remains after disconnect.

### P11 — Staleness is always visible
Every holdings/performance view carries `last_synced`, and the UI flags data older than a freshness threshold, so a user never mistakes a stale snapshot for live data.

---

## 5. Open decisions (stretch — to confirm if/when prioritized)

1. **Aggregator choice** — SnapTrade (retail-investing focused, supports Robinhood) vs. Plaid Investments. Affects scopes, pricing, and the link flow. *(Leaning SnapTrade for Robinhood coverage.)*
2. **Holdings home** — a tab on MainPage vs. a dedicated `/holdings` route.
3. **Sync cadence** — manual-only vs. periodic background sync (and rate/cost implications).
4. **Leaderboard ranking + anonymization defaults** — opt-in granularity and how returns are normalized for fair comparison (time-weighted vs. simple).
