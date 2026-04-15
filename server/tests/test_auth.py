"""
test_auth.py — integration tests for the /auth/* routes.

Uses the Flask test client with a fresh in-memory SQLite DB.
No external services (Postgres, Redis) are needed.
"""
import pytest


class TestRegister:
    """Tests for POST /auth/register"""

    def test_register_success_returns_token(self, client):
        """A valid registration payload should return 200 and a JWT token."""
        resp = client.post("/auth/register", json={
            "username": "newuser",
            "email": "new@example.com",
            "password": "securepass123",
        })
        data = resp.get_json()
        assert resp.status_code == 200
        assert "token" in data
        assert data["username"] == "newuser"

    def test_register_duplicate_username_returns_409(self, client):
        """Registering a username that already exists should return 409."""
        payload = {
            "username": "dupuser",
            "email": "dup@example.com",
            "password": "pass123",
        }
        client.post("/auth/register", json=payload)
        resp = client.post("/auth/register", json=payload)
        assert resp.status_code == 409
        assert "error" in resp.get_json()


class TestLogin:
    """Tests for POST /auth/login"""

    def test_login_with_correct_credentials_returns_token(self, client):
        """Valid credentials should return 200 and a JWT token."""
        client.post("/auth/register", json={
            "username": "loginuser",
            "email": "login@example.com",
            "password": "goodpassword",
        })
        resp = client.post("/auth/login", json={
            "username": "loginuser",
            "password": "goodpassword",
        })
        data = resp.get_json()
        assert resp.status_code == 200
        assert "token" in data

    def test_login_with_wrong_password_returns_401(self, client):
        """A wrong password should return 401 Unauthorized."""
        client.post("/auth/register", json={
            "username": "wrongpassuser",
            "email": "wp@example.com",
            "password": "correctpass",
        })
        resp = client.post("/auth/login", json={
            "username": "wrongpassuser",
            "password": "WRONGPASSWORD",
        })
        assert resp.status_code == 401
        assert "error" in resp.get_json()

    def test_login_with_nonexistent_user_returns_401(self, client):
        """Logging in with a username that doesn't exist should return 401."""
        resp = client.post("/auth/login", json={
            "username": "ghost_user_doesnt_exist",
            "password": "doesntmatter",
        })
        assert resp.status_code == 401


class TestLogout:
    """Tests for POST /auth/logout"""

    def test_logout_always_succeeds(self, client):
        """Logout is stateless (JWT), so it should always return 200."""
        resp = client.post("/auth/logout")
        assert resp.status_code == 200
        assert "message" in resp.get_json()


class TestGetCurrentUser:
    """Tests for GET /auth/@me"""

    def test_get_me_without_token_returns_401(self, client):
        """Accessing /auth/@me without a token should return 401."""
        resp = client.get("/auth/@me")
        assert resp.status_code == 401

    def test_get_me_with_valid_token_returns_user(self, client, auth_headers):
        """A valid Bearer token should return the current user's info."""
        resp = client.get("/auth/@me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "username" in data
        assert "email" in data
