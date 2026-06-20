# Requirements — Peer Matchmaker

> Derived from `design.md`. Property tags reference design Correctness Properties.

---

## R1 — Identify competitors for the viewed stock
**User story:** As a user viewing a stock, I want to see 3–5 direct competitors, so that I avoid familiarity bias.

**Acceptance criteria:**
- THE SYSTEM SHALL read the subject's sector/industry from cached `StockMaster` first, falling back to a live `OVERVIEW` only if missing (P8).
- THE SYSTEM SHALL feed the subject's identity/industry to Claude and return 3–5 competitors.
- THE SYSTEM SHALL never include the subject stock in its own peer list (P1).
- THE SYSTEM SHALL dedupe peers and cap at 5 (P2).
- IF Claude output is malformed, THE SYSTEM SHALL return an empty peer set with a friendly message, not a 500 (P4).

## R2 — Render peers with comparison metrics
**User story:** As a user, I want each peer shown with market cap, P/E, and debt-to-equity, so that I can compare at a glance.

**Acceptance criteria:**
- THE SYSTEM SHALL display each peer's metrics from cached `StockMaster` when known and render "—" when absent (never a fake 0) (P3).
- THE SYSTEM SHALL show a better/worse indicator relative to the subject only when both values exist (P3).
- THE SYSTEM SHALL include a brief AI insight contrasting the subject with the strongest alternative, length-bounded (P7).
- THE SYSTEM SHALL provide a ＋ Add-to-list button per peer using the shared add path (P9, feature 02 P12).

## R3 — Compare with a peer
**User story:** As a user, I want a "Compare" button next to each peer that takes me to the deep-comparison tool, so that I can analyze them side by side.

**Acceptance criteria:**
- WHEN the user clicks "Compare", THE SYSTEM SHALL ensure both the subject and peer exist in `StockMaster` (idempotent ingest) before navigating (P5).
- THE SYSTEM SHALL set the existing `selectedSymbols` to `[subject, peer]` and navigate to `/main` (the existing compare tool).

## R4 — Cost control
**Acceptance criteria:**
- THE SYSTEM SHALL cache peer results per subject symbol for 24h and SHALL not cache empty results (P6).
- THE SYSTEM SHALL not add peers to the user's portfolio merely by viewing them (P9).
