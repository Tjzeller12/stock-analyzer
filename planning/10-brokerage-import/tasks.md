# Tasks — Brokerage Portfolio Import (Stretch)

> (Rn) requirement · (Pn) property. Depends on feature 09 secret hygiene + feature 08 (template link for community). Confirm aggregator choice (SnapTrade vs Plaid) before starting §1.

- [ ] 0. Spike / decision
  - [ ] 0.1 Choose aggregator (SnapTrade leaning for Robinhood coverage); document scopes, pricing, link flow
  - [ ] 0.2 Provision sandbox credentials + encryption key (Fernet/KMS) via env (feature 09)

- [ ] 1. Models & migration
  - [ ] 1.1 Add `BrokerageConnection` (encrypted token, status, last_synced) (R1, P2)
  - [ ] 1.2 Add `Holding` (unique `connection_id,symbol`) (R2, P3)
  - [ ] 1.3 Add `PerformanceSnapshot` (totals, is_public, template_id) (R3, R4)
  - [ ] 1.4 Alembic migration

- [ ] 2. Service
  - [ ] 2.1 Create `server/app/services/brokerage_service.py` — aggregator adapter, encrypt/decrypt tokens (R1, P2)
  - [ ] 2.2 `sync_holdings(connection)` — ingest symbols into `StockMaster`, upsert/delete reconcile, per-symbol error tolerance (R2, P3, P4, P6)
  - [ ] 2.3 `compute_performance(user)` — broker cost basis only, write snapshot (R3, P5)

- [ ] 3. Routes
  - [ ] 3.1 `POST /brokerage/connect/start` + `/connect/callback` (store encrypted connection) (R1)
  - [ ] 3.2 `POST /brokerage/sync` (R2)
  - [ ] 3.3 `GET /brokerage/holdings` (holdings + performance + last_synced) (R3, P11)
  - [ ] 3.4 `POST /brokerage/disconnect` (purge) (R5, P10)
  - [ ] 3.5 `POST /brokerage/publish` (opt-in community, anonymize option) (R4, P7, P9)

- [ ] 4. Client
  - [ ] 4.1 Add `Holding`, `PerformanceSummary`, `BrokerageConnectionStatus` types
  - [ ] 4.2 Create `client/src/hooks/useBrokerageManager.tsx` (R1–R5)
  - [ ] 4.3 Create `components/common/HoldingsTable.tsx` (reuse grid + cost/PnL cols + radar) (R3, P6)
  - [ ] 4.4 Create `components/common/PerformanceSummary.tsx` (R3)
  - [ ] 4.5 Create `components/community/CommunityLeaderboard.tsx` (verified only) (R4, P8)
  - [ ] 4.6 Add holdings surface (tab on MainPage or `/holdings` route) + staleness flag (R3, P11)

- [ ] 5. Tests
  - [ ] 5.1 Backend — sync idempotent/convergent (P3), per-symbol failure tolerance (P4), performance from cost basis (P5), disconnect purges (P10), tokens never serialized (P2)
  - [ ] 5.2 Backend — publish requires verified connection (P8), privacy defaults (P7, P9)
  - [ ] 5.3 Frontend — holdings reuse radar/metrics consistently (P6), staleness flag (P11)
