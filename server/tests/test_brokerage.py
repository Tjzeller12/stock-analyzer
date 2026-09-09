"""
test_brokerage.py — brokerage import (feature 10).

Provider I/O is faked (no SDK, keys, or network). Covers token encryption (P2),
idempotent/convergent sync (P3), per-symbol failure tolerance (P4), broker-sourced
performance (P5), token never serialized (P2), disconnect purge (P10), and the
publish verification gate + privacy defaults (P7/P8/P9).
"""
import base64
import datetime
import uuid

import pytest

from app import db
from app.models import BrokerageConnection, Holding, PerformanceSnapshot, StockMaster, User
from app.routes.auth import create_token
from app.services import brokerage_service
from app.services.brokerage.base import BrokerageProvider, LinkSession, RawPosition
from app.utils.crypto import decrypt_token, encrypt_token

# A deterministic, valid Fernet key (32 bytes, url-safe base64).
TEST_FERNET_KEY = base64.urlsafe_b64encode(b"0" * 32).decode()


@pytest.fixture(autouse=True)
def _enc_key(app):
    app.config["BROKERAGE_ENCRYPTION_KEY"] = TEST_FERNET_KEY
    yield


@pytest.fixture
def user(app):
    u = User(
        username=f"u_{uuid.uuid4().hex[:8]}",
        email=f"{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x",
    )
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def headers(user):
    return {"Authorization": f"Bearer {create_token(user.id)}"}


class FakeProvider(BrokerageProvider):
    name = "snaptrade"

    def __init__(self, positions=None, brokerage_name="Robinhood"):
        self._positions = positions or []
        self._brokerage_name = brokerage_name
        self.revoked = False

    def create_link_session(self, user, existing_secret=None):
        return LinkSession(
            redirect_uri="https://app.snaptrade.com/portal/abc",
            secret=existing_secret or "user-secret-123",
            provider_user_ref=f"sa_{user.id}",
        )

    def fetch_positions(self, *, secret, provider_user_ref):
        return self._brokerage_name, self._positions

    def revoke(self, *, secret, provider_user_ref):
        self.revoked = True


def _seed_stock(symbol, price, *, name=None, sector="Technology"):
    """Seed a StockMaster that looks like a real AV equity (name ≠ ticker)."""
    sm = StockMaster.query.filter_by(symbol=symbol).first()
    if sm is None:
        sm = StockMaster(symbol=symbol)
        db.session.add(sm)
    sm.price = price
    sm.name = name or f"{symbol} Inc"
    sm.sector = sector
    sm.last_stock_update = datetime.datetime.utcnow()
    db.session.commit()
    return sm


def _active_connection(user, secret="user-secret-123"):
    conn = BrokerageConnection(
        user_id=user.id,
        provider="snaptrade",
        provider_user_ref=f"sa_{user.id}",
        access_token_enc=encrypt_token(secret),
        status="active",
    )
    db.session.add(conn)
    db.session.commit()
    return conn


# --- Encryption (P2) ---------------------------------------------------------

class TestCrypto:
    def test_roundtrip(self, app):
        token = encrypt_token("super-secret")
        assert isinstance(token, bytes)
        assert token != b"super-secret"
        assert decrypt_token(token) == "super-secret"


# --- Connection lifecycle ----------------------------------------------------

class TestStartConnection:
    def test_persists_encrypted_secret(self, user):
        provider = FakeProvider()
        result = brokerage_service.start_connection(user, provider=provider)
        assert result["redirect_uri"].startswith("https://")

        conn = BrokerageConnection.query.get(result["connection_id"])
        assert conn.status == "pending"
        assert conn.access_token_enc is not None
        # Stored encrypted, decrypts back to the provider secret.
        assert decrypt_token(conn.access_token_enc) == "user-secret-123"


# --- Sync reconciliation (P3, P4) -------------------------------------------

class TestSyncHoldings:
    def test_creates_holdings(self, user):
        _seed_stock("AAPL", 210.0)
        _seed_stock("MSFT", 400.0)
        conn = _active_connection(user)
        provider = FakeProvider(positions=[
            RawPosition("AAPL", 10, 150.0),
            RawPosition("MSFT", 5, 300.0),
        ])
        holdings = brokerage_service.sync_holdings(conn, provider=provider, ingest=lambda s: None)
        assert {h.symbol for h in holdings} == {"AAPL", "MSFT"}
        assert conn.brokerage_name == "Robinhood"
        assert conn.last_synced is not None

    def test_idempotent_no_duplicates(self, user):
        _seed_stock("AAPL", 210.0)
        conn = _active_connection(user)
        provider = FakeProvider(positions=[RawPosition("AAPL", 10, 150.0)])
        brokerage_service.sync_holdings(conn, provider=provider, ingest=lambda s: None)
        brokerage_service.sync_holdings(conn, provider=provider, ingest=lambda s: None)
        assert Holding.query.filter_by(connection_id=conn.id).count() == 1

    def test_convergent_removes_vanished(self, user):
        _seed_stock("AAPL", 210.0)
        _seed_stock("MSFT", 400.0)
        conn = _active_connection(user)
        brokerage_service.sync_holdings(
            conn,
            provider=FakeProvider(positions=[RawPosition("AAPL", 10, 150.0), RawPosition("MSFT", 5, 300.0)]),
            ingest=lambda s: None,
        )
        # Next sync no longer has MSFT.
        brokerage_service.sync_holdings(
            conn,
            provider=FakeProvider(positions=[RawPosition("AAPL", 12, 150.0)]),
            ingest=lambda s: None,
        )
        symbols = {h.symbol for h in Holding.query.filter_by(connection_id=conn.id).all()}
        assert symbols == {"AAPL"}
        aapl = Holding.query.filter_by(connection_id=conn.id, symbol="AAPL").first()
        assert aapl.quantity == 12  # updated in place

    def test_per_symbol_failure_does_not_abort(self, user):
        _seed_stock("GOOD", 100.0)  # BADSYM intentionally not seeded

        def flaky_ingest(symbol):
            if symbol == "BADSYM":
                raise RuntimeError("cannot resolve")

        conn = _active_connection(user)
        provider = FakeProvider(positions=[RawPosition("GOOD", 1, 50.0), RawPosition("BADSYM", 2, 10.0)])
        brokerage_service.sync_holdings(conn, provider=provider, ingest=flaky_ingest)
        symbols = {h.symbol for h in Holding.query.filter_by(connection_id=conn.id).all()}
        # P4: the failure does not abort the sync, but unusable symbols are not recorded.
        assert symbols == {"GOOD"}

    def test_skips_crypto_even_if_master_has_a_price(self, user):
        _seed_stock("BTC", 34.84, name="BTC", sector=None)
        conn = _active_connection(user)
        brokerage_service.sync_holdings(
            conn,
            provider=FakeProvider(positions=[
                RawPosition("BTC", 0.02, 111000.0, asset_type="crypto"),
            ]),
            ingest=lambda s: None,
        )
        assert Holding.query.filter_by(connection_id=conn.id).count() == 0

    def test_skips_stub_master_row_without_fundamentals(self, user):
        # Leftover junk quote: name == ticker, no sector — AV never really ingested it.
        _seed_stock("XRP", 15.0, name="XRP", sector=None)
        conn = _active_connection(user)
        brokerage_service.sync_holdings(
            conn,
            provider=FakeProvider(positions=[RawPosition("XRP", 100, 2.77)]),
            ingest=lambda s: None,
        )
        assert Holding.query.filter_by(connection_id=conn.id).count() == 0

    def test_drops_existing_unusable_holdings_on_resync(self, user):
        _seed_stock("AAPL", 210.0)
        _seed_stock("BTC", 34.84, name="BTC", sector=None)
        conn = _active_connection(user)
        db.session.add(Holding(connection_id=conn.id, symbol="BTC", quantity=0.02, avg_cost=111000.0))
        db.session.commit()
        brokerage_service.sync_holdings(
            conn,
            provider=FakeProvider(positions=[
                RawPosition("AAPL", 10, 150.0),
                RawPosition("BTC", 0.02, 111000.0, asset_type="crypto"),
            ]),
            ingest=lambda s: None,
        )
        symbols = {h.symbol for h in Holding.query.filter_by(connection_id=conn.id).all()}
        assert symbols == {"AAPL"}


# --- Performance (P5) --------------------------------------------------------

class TestPerformance:
    def test_computed_from_cost_basis(self, user):
        _seed_stock("AAPL", 210.0)
        _seed_stock("MSFT", 100.0)
        conn = _active_connection(user)
        brokerage_service.sync_holdings(
            conn,
            provider=FakeProvider(positions=[RawPosition("AAPL", 10, 150.0), RawPosition("MSFT", 5, 200.0)]),
            ingest=lambda s: None,
        )
        perf = brokerage_service.compute_performance(user, persist=True)
        # cost = 10*150 + 5*200 = 2500 ; value = 10*210 + 5*100 = 2600
        assert perf["total_cost_basis"] == pytest.approx(2500.0)
        assert perf["total_value"] == pytest.approx(2600.0)
        assert perf["total_return"] == pytest.approx(100.0)
        assert perf["total_return_pct"] == pytest.approx(4.0)
        assert PerformanceSnapshot.query.filter_by(user_id=user.id).count() == 1


# --- Routes ------------------------------------------------------------------

class TestRoutesAuth:
    def test_start_requires_auth(self, client):
        assert client.post("/brokerage/connect/start").status_code == 401

    def test_holdings_requires_auth(self, client):
        assert client.get("/brokerage/holdings").status_code == 401


class TestHoldingsView:
    def test_never_serializes_token(self, client, user, headers):
        _seed_stock("AAPL", 210.0)
        conn = _active_connection(user, secret="TOP-SECRET-TOKEN")
        brokerage_service.sync_holdings(
            conn, provider=FakeProvider(positions=[RawPosition("AAPL", 10, 150.0)]), ingest=lambda s: None
        )
        resp = client.get("/brokerage/holdings", headers=headers)
        assert resp.status_code == 200
        raw = resp.get_data(as_text=True)
        assert "TOP-SECRET-TOKEN" not in raw
        assert "access_token" not in raw
        data = resp.get_json()
        assert data["status"]["connected"] is True
        assert data["holdings"][0]["symbol"] == "AAPL"
        assert data["holdings"][0]["unrealized_pnl"] == pytest.approx(600.0)

    def test_hides_stub_holdings_even_before_resync(self, client, user, headers):
        _seed_stock("AAPL", 210.0)
        _seed_stock("ETH", 23.58, name="ETH", sector=None)
        conn = _active_connection(user)
        db.session.add(Holding(connection_id=conn.id, symbol="AAPL", quantity=10, avg_cost=150.0))
        db.session.add(Holding(connection_id=conn.id, symbol="ETH", quantity=1, avg_cost=3600.0))
        db.session.commit()
        resp = client.get("/brokerage/holdings", headers=headers)
        symbols = {h["symbol"] for h in resp.get_json()["holdings"]}
        assert symbols == {"AAPL"}

    def test_sync_route_uses_provider(self, client, user, headers, monkeypatch):
        _seed_stock("AAPL", 210.0)
        _active_connection(user)
        monkeypatch.setattr(
            brokerage_service,
            "get_provider",
            lambda *a, **k: FakeProvider(positions=[RawPosition("AAPL", 3, 100.0)]),
        )
        resp = client.post("/brokerage/sync", headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["holdings"][0]["symbol"] == "AAPL"


# --- Disconnect (P10) --------------------------------------------------------

class TestDisconnect:
    def test_purges_connection_and_holdings(self, user):
        _seed_stock("AAPL", 210.0)
        conn = _active_connection(user)
        brokerage_service.sync_holdings(
            conn, provider=FakeProvider(positions=[RawPosition("AAPL", 1, 1.0)]), ingest=lambda s: None
        )
        conn_id = conn.id
        provider = FakeProvider()
        brokerage_service.disconnect(conn, purge_holdings=True, provider=provider)
        assert provider.revoked is True
        assert BrokerageConnection.query.get(conn_id) is None
        assert Holding.query.filter_by(connection_id=conn_id).count() == 0

    def test_keep_holdings_revokes_token_only(self, user):
        conn = _active_connection(user)
        brokerage_service.disconnect(conn, purge_holdings=False, provider=FakeProvider())
        refreshed = BrokerageConnection.query.get(conn.id)
        assert refreshed.status == "revoked"
        assert refreshed.access_token_enc is None


# --- Publish gating + privacy (P7, P8, P9) ----------------------------------

class TestPublish:
    def test_requires_verified_connection(self, client, user, headers):
        resp = client.post("/brokerage/publish", headers=headers, json={})
        assert resp.status_code == 400

    def test_publishes_anonymized_by_default(self, client, user, headers):
        _seed_stock("AAPL", 210.0)
        conn = _active_connection(user)
        brokerage_service.sync_holdings(
            conn, provider=FakeProvider(positions=[RawPosition("AAPL", 10, 150.0)]), ingest=lambda s: None
        )
        resp = client.post("/brokerage/publish", headers=headers, json={"anonymize": True})
        assert resp.status_code == 200
        snap = PerformanceSnapshot.query.filter_by(user_id=user.id, is_public=True).first()
        assert snap is not None
        assert snap.total_return_pct is not None
        # Anonymized: dollar balances are withheld (P9).
        assert snap.total_value is None
        assert snap.total_cost_basis is None
