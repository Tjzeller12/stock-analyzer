"""
brokerage provider package — factory + re-exports.

`get_provider()` resolves the configured aggregator (default SnapTrade). Callers
can override by name (e.g. per-connection `connection.provider`) so a user
connected via SnapTrade keeps using SnapTrade even if the global default changes.
"""
from flask import current_app

from app.services.brokerage.base import BrokerageProvider, LinkSession, RawPosition
from app.services.brokerage.plaid_provider import PlaidProvider
from app.services.brokerage.snaptrade_provider import SnapTradeProvider

_PROVIDERS = {
    "snaptrade": SnapTradeProvider,
    "plaid": PlaidProvider,
}


def get_provider(name: str | None = None) -> BrokerageProvider:
    """Return a provider instance. Falls back to config's BROKERAGE_PROVIDER, then
    to SnapTrade."""
    key = (name or current_app.config.get("BROKERAGE_PROVIDER") or "snaptrade").lower()
    provider_cls = _PROVIDERS.get(key)
    if provider_cls is None:
        raise ValueError(f"Unknown brokerage provider: {key}")
    return provider_cls()


__all__ = [
    "BrokerageProvider",
    "LinkSession",
    "RawPosition",
    "SnapTradeProvider",
    "PlaidProvider",
    "get_provider",
]
