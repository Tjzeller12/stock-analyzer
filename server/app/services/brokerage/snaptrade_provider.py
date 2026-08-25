"""
snaptrade_provider.py — SnapTrade implementation of BrokerageProvider.

SnapTrade model:
  - We provision a SnapTrade "user" keyed by our user id; SnapTrade returns a
    `userSecret`. That secret (NOT a broker password) is what we store encrypted.
  - The hosted Connection Portal handles the broker OAuth; we only get read-only
    positions back. We never request `connectionType=trade` (P1).

The SnapTrade SDK is imported lazily so the app and the test suite run without the
package/keys present; it's only needed when a real connection is exercised.

NOTE: method/return shapes follow snaptrade-python-sdk v11. Verify against the
installed SDK during the first live connection and adjust the thin mapping below
if the SDK surface differs — all SDK coupling is isolated to this file.
"""
from flask import current_app

from app.services.brokerage.base import BrokerageProvider, LinkSession, RawPosition


def _client():
    """Build the SnapTrade SDK client from config. Lazy import + clear errors."""
    try:
        from snaptrade_client import SnapTrade
    except ImportError as e:  # pragma: no cover - depends on optional dep
        raise RuntimeError(
            "snaptrade-python-sdk is not installed. Run `pip install -r requirements.txt`."
        ) from e

    client_id = current_app.config.get("SNAPTRADE_CLIENT_ID")
    consumer_key = current_app.config.get("SNAPTRADE_CONSUMER_KEY")
    if not client_id or not consumer_key:
        raise RuntimeError(
            "SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY are not set. Add them to your .env."
        )
    return SnapTrade(consumer_key=consumer_key, client_id=client_id)


def _provider_user_id(user) -> str:
    """Deterministic, namespaced SnapTrade userId for our user."""
    return f"sa_{user.id}"


def _body(resp):
    """SDK responses expose parsed JSON on `.body`; fall back to the object."""
    return getattr(resp, "body", resp)


class SnapTradeProvider(BrokerageProvider):
    name = "snaptrade"

    def create_link_session(self, user, existing_secret: str | None = None) -> LinkSession:
        client = _client()
        provider_user_ref = _provider_user_id(user)

        secret = existing_secret
        if not secret:
            resp = client.authentication.register_snap_trade_user(
                body={"userId": provider_user_ref}
            )
            secret = _body(resp)["userSecret"]

        # Read-only portal session. connectionType defaults to read; we set it
        # explicitly so trading is never requested (P1).
        login = client.authentication.login_snap_trade_user(
            query_params={"userId": provider_user_ref, "userSecret": secret},
            body={
                "connectionType": "read",
                "customRedirect": current_app.config.get("SNAPTRADE_REDIRECT_URI"),
            },
        )
        redirect_uri = _body(login).get("redirectURI")
        if not redirect_uri:
            raise RuntimeError("SnapTrade did not return a redirect URI for the connection portal.")

        return LinkSession(
            redirect_uri=redirect_uri,
            secret=secret,
            provider_user_ref=provider_user_ref,
        )

    def fetch_positions(self, *, secret: str, provider_user_ref: str):
        client = _client()

        accounts = _body(
            client.account_information.list_user_accounts(
                query_params={"userId": provider_user_ref, "userSecret": secret}
            )
        ) or []

        brokerage_name = None
        positions: list[RawPosition] = []

        for account in accounts:
            brokerage_name = brokerage_name or (
                account.get("institution_name") or account.get("brokerage_authorization")
            )
            account_id = account.get("id")
            if not account_id:
                continue

            # accountId is a PATH param (/accounts/{accountId}/positions); only
            # userId/userSecret are query params.
            raw_positions = _body(
                client.account_information.get_user_account_positions(
                    query_params={"userId": provider_user_ref, "userSecret": secret},
                    path_params={"accountId": account_id},
                )
            ) or []

            for pos in raw_positions:
                symbol = _extract_symbol(pos)
                if not symbol:
                    continue
                positions.append(
                    RawPosition(
                        symbol=symbol,
                        quantity=_safe_num(pos.get("units")) or 0.0,
                        avg_cost=_safe_num(pos.get("average_purchase_price")),
                        currency=_extract_currency(pos),
                    )
                )

        return brokerage_name, positions

    def revoke(self, *, secret: str, provider_user_ref: str) -> None:
        try:
            client = _client()
            client.authentication.delete_snap_trade_user(
                query_params={"userId": provider_user_ref}
            )
        except Exception as e:  # remote failure must not block local purge (P10)
            current_app.logger.warning(f"SnapTrade remote revoke failed (continuing): {e}")


def _safe_num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_symbol(pos: dict) -> str | None:
    """SnapTrade nests the symbol under symbol.symbol.symbol (universal symbol)."""
    sym = pos.get("symbol")
    if isinstance(sym, dict):
        inner = sym.get("symbol")
        if isinstance(inner, dict):
            return (inner.get("symbol") or "").upper() or None
        if isinstance(inner, str):
            return inner.upper() or None
    if isinstance(sym, str):
        return sym.upper() or None
    return None


def _extract_currency(pos: dict) -> str:
    sym = pos.get("symbol")
    if isinstance(sym, dict):
        inner = sym.get("symbol")
        if isinstance(inner, dict):
            cur = inner.get("currency")
            if isinstance(cur, dict):
                return cur.get("code") or "USD"
    return "USD"
