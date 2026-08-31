# Tasks — Brokerage Portfolio Import (Stretch)

> (Rn) requirement · (Pn) property. Depends on feature 09 secret hygiene + feature 08 (template link for community). Confirm aggregator choice (SnapTrade vs Plaid) before starting §1.

- [x] 0. Spike / decision
  - [x] 0.1 Choose aggregator (SnapTrade leaning for Robinhood coverage); document scopes, pricing, link flow
  - [x] 0.2 Provision sandbox credentials + encryption key (Fernet/KMS) via env (feature 09) — env wiring + Fernet util done; user supplies the actual keys

- [x] 1. Models & migration
  - [x] 1.1 Add `BrokerageConnection` (encrypted token, status, last_synced) (R1, P2)
  - [x] 1.2 Add `Holding` (unique `connection_id,symbol`) (R2, P3)
  - [x] 1.3 Add `PerformanceSnapshot` (totals, is_public, template_id) (R3, R4)
  - [x] 1.4 Alembic migration

- [x] 2. Service
  - [x] 2.1 Create `server/app/services/brokerage_service.py` — provider adapter, encrypt/decrypt tokens (R1, P2)
  - [x] 2.2 `sync_holdings(connection)` — ingest symbols into `StockMaster`, upsert/delete reconcile, per-symbol error tolerance (R2, P3, P4, P6)
  - [x] 2.3 `compute_performance(user)` — broker cost basis only, write snapshot (R3, P5)
  - [x] 2.4 Provider abstraction: `services/brokerage/` (BrokerageProvider, SnapTradeProvider, Plaid stub, factory) — Plaid-ready

- [x] 3. Routes
  - [x] 3.1 `POST /brokerage/connect/start` + `/connect/callback` (store encrypted connection) (R1)
  - [x] 3.2 `POST /brokerage/sync` (R2)
  - [x] 3.3 `GET /brokerage/holdings` (holdings + performance + last_synced) (R3, P11)
  - [x] 3.4 `POST /brokerage/disconnect` (purge) (R5, P10)
  - [x] 3.5 `POST /brokerage/publish` (opt-in community, anonymize option) (R4, P7, P9)

- [x] 4. Client
  - [x] 4.1 Add `Holding`, `PerformanceSummary`, `BrokerageConnectionStatus` types
  - [x] 4.2 Create `client/src/hooks/useBrokerageManager.tsx` (R1–R5)
  - [x] 4.3 Create `components/holdings/HoldingsTable.tsx` (cost/PnL cols) (R3) — per-row radar reuse deferred (P6)
  - [x] 4.4 Create `components/holdings/PerformanceSummary.tsx` (R3)
  - [ ] 4.5 Create `components/community/CommunityLeaderboard.tsx` (verified only) (R4, P8) — deferred; depends on feature 08
  - [x] 4.6 Add holdings surface (`/holdings` route + Header nav) + staleness flag (R3, P11)

- [x] 5. Tests
  - [x] 5.1 Backend — sync idempotent/convergent (P3), per-symbol failure tolerance (P4), performance from cost basis (P5), disconnect purges (P10), tokens never serialized (P2)
  - [x] 5.2 Backend — publish requires verified connection (P8), privacy defaults (P7, P9)
  - [ ] 5.3 Frontend — holdings reuse radar/metrics consistently (P6) — deferred with per-row radar; staleness flag (P11) done + hook tested
