"""
base.py — the provider-agnostic brokerage aggregator interface.

SnapTrade ships first; Plaid (and others) implement the same interface so the
service/routes/models never change. Providers are STATELESS with respect to our
DB: the service decrypts the stored secret and passes it in; the provider talks
to the aggregator and returns normalized data. Tokens/secrets are handled by the
service (encrypted at rest — P2); providers never touch our database.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class RawPosition:
    """A single normalized position returned by an aggregator."""
    symbol: str
    quantity: float
    avg_cost: float | None      # per-share cost basis; None if broker doesn't expose it
    currency: str = "USD"
    asset_type: str | None = None  # e.g. "crypto", "cs", "etf" — from the aggregator


@dataclass
class LinkSession:
    """Result of starting a connection: the hosted-flow URL plus the
    provider-issued references the service must persist (encrypted) to fetch
    holdings later."""
    redirect_uri: str
    secret: str                 # provider secret (e.g. SnapTrade userSecret / Plaid access_token)
    provider_user_ref: str      # provider user/item id (e.g. SnapTrade userId / Plaid item_id)


class BrokerageProvider(ABC):
    """Read-only brokerage aggregator. Implementations must request positions
    scope only — never trading (P1)."""

    name: str = "base"

    @abstractmethod
    def create_link_session(self, user, existing_secret: str | None = None) -> LinkSession:
        """Start (or re-auth) a hosted, read-only connection flow for `user`.
        If `existing_secret` is provided, reuse it (reconnect) instead of
        provisioning a new aggregator identity."""
        raise NotImplementedError

    @abstractmethod
    def fetch_positions(
        self, *, secret: str, provider_user_ref: str
    ) -> tuple[str | None, list[RawPosition]]:
        """Return `(brokerage_name, positions)` for a connected account.
        `brokerage_name` may be None if the aggregator doesn't surface it."""
        raise NotImplementedError

    def revoke(self, *, secret: str, provider_user_ref: str) -> None:
        """Best-effort remote revoke. The hard guarantee is the local purge in
        the service (P10); a remote failure must not block disconnect."""
        return None
