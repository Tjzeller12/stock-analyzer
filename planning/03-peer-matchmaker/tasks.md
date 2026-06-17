# Tasks — Peer Matchmaker

> (Rn) requirement · (Pn) property. Reuses `StructuredAlphaBotAnalysis`, the compare flow, and `AddToListButton` (feature 02).

- [ ] 1. Server: analysis + prompt
  - [ ] 1.1 Create `server/app/prompts/peer_matchmaker.md` + add `PEER_MATCHMAKER_PROMPT` to `constants.py` (R1)
  - [ ] 1.2 Add `PeerAnalysis(StructuredAlphaBotAnalysis)` to `alphaBot/analysis.py` with `build_placeholders`/`default_result` (R1, P4)

- [ ] 2. Server: routes
  - [ ] 2.1 Add `POST /alphaBot/peers` to `alphaBot/blueprint.py` — subject lookup, 24h cache, run analysis (R1, R4, P6)
  - [ ] 2.2 Implement `_enrich_and_filter_peers()` — drop subject (P1), dedupe/cap (P2), fill metrics from cache or null (P3)
  - [ ] 2.3 Implement `_bound()` for the insight string (P7)
  - [ ] 2.4 Add `POST /portfolio/prepare_compare` — idempotent `ensure_stock_masters(symbols)` via `stock_manager` (R3, P5)

- [ ] 3. Client: types & hook
  - [ ] 3.1 Add `PeerCompetitor`, `PeerMatchmakerResult` to `types.ts` (R1, R2)
  - [ ] 3.2 Create `client/src/hooks/usePeerMatchmaker.tsx` — fetch, `compareWithPeer` (prepare → set selectedSymbols → navigate) (R1, R3)
  - [ ] 3.3 Add peer + prepare_compare endpoints to `constants/api.ts`

- [ ] 4. Client: components on StockPage
  - [ ] 4.1 Create `components/discovery/PeerMatchmakerCard.tsx` (R1, R2)
  - [ ] 4.2 Create `components/discovery/PeerRow.tsx` with metrics, better/worse indicator, `AddToListButton`, Compare button (R2, R3, P3)
  - [ ] 4.3 Mount `PeerMatchmakerCard` in `pages/StockPage.tsx`

- [ ] 5. Tests
  - [ ] 5.1 Backend `test_peers.py` — subject excluded (P1), dedup/cap (P2), malformed → empty (P4), cache 24h non-empty only (P6), prepare_compare idempotent (P5)
  - [ ] 5.2 Frontend `usePeerMatchmaker.test.tsx` — compareWithPeer wiring, loading cleared
  - [ ] 5.3 Frontend `PeerRow.test.tsx` — "—" for null metrics (P3), indicator only when both present
