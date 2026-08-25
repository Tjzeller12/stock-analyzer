"""
brokerage_service.py — orchestration for the brokerage import feature (feature 10).

Owns the DB + encryption; delegates all aggregator I/O to a BrokerageProvider
(SnapTrade now, Plaid later). Key guarantees:
  - Aggregator secrets encrypted at rest, never serialized (P2).
  - Sync is idempotent + convergent: upsert present, delete vanished (P3).
  - A symbol the analysis stack can't resolve never fails the whole sync (P4).
  - Holdings reuse StockMaster so radar/metrics match the main table (P6).
  - Performance is computed from broker cost basis only (P5).

Provider and symbol-ingest are injectable so the suite can run without the SDK,
real keys, or network.
"""
from datetime import datetime

from flask import current_app

from app import db
from app.models import BrokerageConnection, Holding, PerformanceSnapshot, StockMaster
from app.services.brokerage import get_provider
from app.services.stock_manager import add_to_master
from app.utils.crypto import decrypt_token, encrypt_token

# Re-ingest a symbol if it's missing or older than this many days (mirrors add_stock).
STOCK_STALE_DAYS = 7


# --- Connection lifecycle ----------------------------------------------------

def start_connection(user, provider_name=None, provider=None):
    """Begin (or re-auth) a read-only connection. Persists a `pending` connection
    with the encrypted aggregator secret and returns the hosted-flow redirect URI."""
    provider = provider or get_provider(provider_name)

    existing = _active_or_pending_connection(user, provider.name)
    existing_secret = None
    if existing and existing.access_token_enc:
        try:
            existing_secret = decrypt_token(existing.access_token_enc)
        except Exception:
            existing_secret = None  # corrupt/rotated key → provision fresh

    session = provider.create_link_session(user, existing_secret=existing_secret)

    connection = existing or BrokerageConnection(user_id=user.id, provider=provider.name)
    connection.provider_user_ref = session.provider_user_ref
    connection.access_token_enc = encrypt_token(session.secret)
    if connection.status not in ("active",):
        connection.status = "pending"
    if connection.id is None:
        db.session.add(connection)
    db.session.commit()

    return {"redirect_uri": session.redirect_uri, "connection_id": connection.id}


def complete_connection(user, provider=None, ingest=add_to_master):
    """Finalize after the hosted flow returns: mark active and run the first sync."""
    connection = _active_or_pending_connection(user, None)
    if connection is None:
        return {"error": "No pending brokerage connection"}, 404
    connection.status = "active"
    db.session.commit()
    sync_holdings(connection, provider=provider, ingest=ingest)
    return {"status": connection.status}, 200


def disconnect(connection, purge_holdings=True, provider=None):
    """Revoke remotely (best-effort) and purge the stored secret. Holdings removed
    per user choice. After this, no usable credential remains (P10)."""
    provider = provider or get_provider(connection.provider)
    secret = None
    if connection.access_token_enc:
        try:
            secret = decrypt_token(connection.access_token_enc)
        except Exception:
            secret = None
    if secret:
        provider.revoke(secret=secret, provider_user_ref=connection.provider_user_ref)

    if purge_holdings:
        db.session.delete(connection)  # cascade removes holdings
    else:
        connection.status = "revoked"
        connection.access_token_enc = None
        connection.provider_user_ref = None
    db.session.commit()


# --- Sync --------------------------------------------------------------------

def sync_holdings(connection, provider=None, ingest=add_to_master):
    """Pull positions and reconcile Holding rows idempotently (P3). Per-symbol
    enrichment failures are tolerated (P4). Returns the reconciled Holding list."""
    provider = provider or get_provider(connection.provider)
    secret = decrypt_token(connection.access_token_enc)

    brokerage_name, positions = provider.fetch_positions(
        secret=secret, provider_user_ref=connection.provider_user_ref
    )
    if brokerage_name:
        connection.brokerage_name = brokerage_name

    seen = set()
    for pos in positions:
        symbol = (pos.symbol or "").upper()
        if not symbol:
            continue

        _ensure_symbol_ingested(symbol, ingest)  # tolerant; never aborts sync (P4)

        holding = Holding.query.filter_by(connection_id=connection.id, symbol=symbol).first()
        if holding is None:
            holding = Holding(connection_id=connection.id, symbol=symbol)
            db.session.add(holding)
        holding.quantity = pos.quantity
        holding.avg_cost = pos.avg_cost
        seen.add(symbol)

    # Remove positions the user no longer holds (convergent reconcile).
    for stale in Holding.query.filter_by(connection_id=connection.id).all():
        if stale.symbol not in seen:
            db.session.delete(stale)

    connection.last_synced = datetime.utcnow()
    if connection.status == "pending":
        connection.status = "active"
    db.session.commit()

    return Holding.query.filter_by(connection_id=connection.id).all()


def _ensure_symbol_ingested(symbol, ingest):
    """Ingest a symbol into StockMaster if missing/stale. Failures are swallowed so
    one bad symbol never fails the whole sync (P4)."""
    try:
        existing = StockMaster.query.filter_by(symbol=symbol).first()
        is_stale = (
            existing is None
            or existing.last_stock_update is None
            or (datetime.utcnow() - existing.last_stock_update).days > STOCK_STALE_DAYS
        )
        if is_stale:
            ingest(symbol)
    except Exception as e:
        current_app.logger.warning(f"Holding symbol enrichment failed for {symbol}: {e}")


# --- Performance & holdings views -------------------------------------------

def _user_active_connections(user):
    return [c for c in user.brokerage_connections if c.status == "active"]


def get_holdings_view(user):
    """Build the holdings + performance payload. Each holding merges the full
    StockMaster row (so the portfolio table mirrors the watchlist table + radar — P6)
    with broker-provided position fields (quantity, avg cost, market value, P&L).
    No token material is included (P2)."""
    connections = _user_active_connections(user)
    stock_map = _stock_map_for(connections)
    # Treat 0 as "no price" (Alpha Vantage rate limits / crypto return no quote) so
    # it renders as "—" and never skews performance.
    price_map = {sym: sm.price for sym, sm in stock_map.items() if sm.price}

    holdings_out = []
    for connection in connections:
        for holding in connection.holdings:
            sm = stock_map.get(holding.symbol)
            base = sm.to_dict() if sm else {"symbol": holding.symbol, "price": None}
            position = holding.to_dict(current_price=(sm.price if sm and sm.price else None))
            # position fields (quantity/avg_cost/market_value/P&L/current_price) win on overlap
            holdings_out.append({**base, **position})

    performance = _aggregate_performance(connections, price_map)
    status = _connection_status(connections)
    return {"status": status, "holdings": holdings_out, "performance": performance}


def compute_performance(user, persist=True):
    """Compute totals from broker cost basis vs. live price and (optionally) write a
    PerformanceSnapshot (P5). Returns the performance dict."""
    connections = _user_active_connections(user)
    price_map = _price_map_for(connections)
    performance = _aggregate_performance(connections, price_map)

    if persist and connections:
        snapshot = PerformanceSnapshot(
            user_id=user.id,
            total_value=performance["total_value"],
            total_cost_basis=performance["total_cost_basis"],
            total_return=performance["total_return"],
            total_return_pct=performance["total_return_pct"],
            is_public=False,  # private by default (P7)
        )
        db.session.add(snapshot)
        db.session.commit()

    return performance


def publish_performance(user, template_id=None, anonymize=True):
    """Create a PUBLIC snapshot for the community leaderboard. Requires a verified,
    synced connection with holdings (P8); never derived from self-reported data."""
    connections = _user_active_connections(user)
    has_holdings = any(c.holdings for c in connections)
    if not connections or not has_holdings:
        return {"error": "Connect and sync a brokerage before publishing performance"}, 400

    price_map = _price_map_for(connections)
    performance = _aggregate_performance(connections, price_map)

    snapshot = PerformanceSnapshot(
        user_id=user.id,
        total_return_pct=performance["total_return_pct"],
        is_public=True,
        template_id=template_id,
    )
    # Minimal sharing: dollar balances are only stored on the public row when the
    # user explicitly opts out of anonymization (P9).
    if not anonymize:
        snapshot.total_value = performance["total_value"]
        snapshot.total_cost_basis = performance["total_cost_basis"]
        snapshot.total_return = performance["total_return"]
    db.session.add(snapshot)
    db.session.commit()
    return {"published": True, "return_pct": performance["total_return_pct"]}, 200


# --- Helpers -----------------------------------------------------------------

def _active_or_pending_connection(user, provider_name):
    for c in user.brokerage_connections:
        if c.status in ("active", "pending") and (provider_name is None or c.provider == provider_name):
            return c
    return None


def _price_map_for(connections):
    # `if sm.price` excludes both None and 0 (unpriced / rate-limited symbols).
    return {sym: sm.price for sym, sm in _stock_map_for(connections).items() if sm.price}


def _stock_map_for(connections):
    """Map {symbol: StockMaster} for every held symbol, in one query."""
    symbols = {h.symbol for c in connections for h in c.holdings}
    if not symbols:
        return {}
    rows = StockMaster.query.filter(StockMaster.symbol.in_(symbols)).all()
    return {r.symbol: r for r in rows}


def _aggregate_performance(connections, price_map):
    total_value = 0.0
    total_cost = 0.0
    for connection in connections:
        for h in connection.holdings:
            qty = h.quantity or 0.0
            avg = h.avg_cost or 0.0
            price = price_map.get(h.symbol)
            # Only count a holding we can actually price on BOTH sides — otherwise
            # its cost basis skews the return hugely negative (e.g. crypto/unpriced
            # symbols would add cost but $0 value). `not price` covers None and 0.
            if not price:
                continue
            total_cost += qty * avg
            total_value += qty * price
    total_return = total_value - total_cost
    total_return_pct = (total_return / total_cost * 100.0) if total_cost else 0.0
    last_synced = _latest_sync(connections)
    return {
        "total_value": total_value,
        "total_cost_basis": total_cost,
        "total_return": total_return,
        "total_return_pct": total_return_pct,
        "last_synced": last_synced.isoformat() if last_synced else None,
    }


def _latest_sync(connections):
    syncs = [c.last_synced for c in connections if c.last_synced]
    return max(syncs) if syncs else None


def _connection_status(connections):
    if not connections:
        return {"connected": False, "brokerage_name": None, "last_synced": None}
    primary = connections[0]
    return {
        "connected": True,
        "brokerage_name": primary.brokerage_name,
        "last_synced": primary.last_synced.isoformat() if primary.last_synced else None,
    }
