"""
plaid_provider.py — Plaid Investments implementation (STUB).

Intentionally unimplemented. The interface and factory are already wired so that
adding Plaid later is a self-contained change in this file plus dependency/config
additions — no service, route, or model changes required.

When implementing:
  - Use plaid-python; build the client from PLAID_CLIENT_ID / PLAID_SECRET / PLAID_ENV.
  - create_link_session  → /link/token/create (products=["investments"]); on the
    public_token returned by Link, exchange for an access_token (the `secret`),
    and use item_id as `provider_user_ref`.
  - fetch_positions      → /investments/holdings/get; map holdings to RawPosition
    (security ticker, quantity, cost_basis / quantity → avg_cost).
  - revoke               → /item/remove.
"""
from app.services.brokerage.base import BrokerageProvider, LinkSession


class PlaidProvider(BrokerageProvider):
    name = "plaid"

    def create_link_session(self, user, existing_secret: str | None = None) -> LinkSession:
        raise NotImplementedError("PlaidProvider is not implemented yet. Use BROKERAGE_PROVIDER=snaptrade.")

    def fetch_positions(self, *, secret: str, provider_user_ref: str):
        raise NotImplementedError("PlaidProvider is not implemented yet. Use BROKERAGE_PROVIDER=snaptrade.")
