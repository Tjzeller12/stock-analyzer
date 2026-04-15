"""
conftest.py — shared fixtures for the backend test suite.

Uses an in-memory SQLite database so tests run without a live
Postgres connection or Docker. A `TestingConfig` overrides the
production config, and the `auth_headers` fixture pre-registers
a test user and returns a valid JWT Bearer token.
"""
import pytest
from app import create_app, db as _db
from app.models import User, Portfolio
from app import bcrypt


class TestingConfig:
    """Isolated config for test runs."""
    TESTING = True
    SECRET_KEY = "test-secret-key"
    # In-memory SQLite — zero external dependencies
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    SESSION_TYPE = "filesystem"
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = False
    FRONTEND_ORIGIN = "http://localhost:3000"
    WTF_CSRF_ENABLED = False


@pytest.fixture(scope="session")
def app():
    """Create the Flask application once per test session."""
    application = create_app(TestingConfig)
    with application.app_context():
        _db.create_all()
        yield application
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app):
    """Provide a fresh Flask test client for each test."""
    return app.test_client()


@pytest.fixture(scope="function")
def auth_headers(client, app):
    """
    Register a unique test user per test function and return
    an Authorization header containing a valid JWT token.
    """
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    payload = {
        "username": f"testuser_{unique_id}",
        "password": "testpass123",
        "email": f"test_{unique_id}@example.com",
    }
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 200, f"Setup failed: {resp.get_json()}"
    token = resp.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}
