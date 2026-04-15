"""
test_profile.py — integration tests for the /profile/* routes.

Verifies authentication guards and core profile operations:
get user info, reset password, and save profile.
"""
import pytest


class TestProfileAuth:
    """Verify all profile routes require authentication."""

    def test_info_without_token_returns_401(self, client):
        resp = client.post("/profile/info", json={})
        assert resp.status_code == 401

    def test_reset_without_token_returns_401(self, client):
        resp = client.post("/profile/reset", json={"newPassword": "newpass"})
        assert resp.status_code == 401

    def test_save_without_token_returns_401(self, client):
        resp = client.post("/profile/save", json={"username": "newname"})
        assert resp.status_code == 401


class TestGetUserInfo:
    """Tests for POST /profile/info"""

    def test_returns_user_info_with_valid_token(self, client, auth_headers):
        resp = client.post("/profile/info", headers=auth_headers, json={})
        assert resp.status_code == 200
        data = resp.get_json()
        # User model to_dict() returns username, email, budget, risk_tolerance_score
        assert "username" in data
        assert "email" in data


class TestResetPassword:
    """Tests for POST /profile/reset"""

    def test_reset_password_with_valid_token_succeeds(self, client, auth_headers):
        resp = client.post(
            "/profile/reset",
            headers=auth_headers,
            json={"newPassword": "brand-new-pass-456"}
        )
        assert resp.status_code == 200
        assert "message" in resp.get_json()

    def test_can_login_with_new_password_after_reset(self, client):
        """End-to-end: register → reset password → login with new password."""
        # Register a dedicated user for this test
        reg = client.post("/auth/register", json={
            "username": "resetme",
            "email": "resetme@example.com",
            "password": "original_pass",
        })
        token = reg.get_json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Reset the password
        client.post("/profile/reset", headers=headers, json={"newPassword": "new_pass_999"})

        # Login with old password should now fail
        fail = client.post("/auth/login", json={"username": "resetme", "password": "original_pass"})
        assert fail.status_code == 401

        # Login with new password should succeed
        ok = client.post("/auth/login", json={"username": "resetme", "password": "new_pass_999"})
        assert ok.status_code == 200


class TestSaveProfile:
    """Tests for POST /profile/save"""

    def test_save_new_username_succeeds(self, client, auth_headers):
        resp = client.post(
            "/profile/save",
            headers=auth_headers,
            json={"username": "updated_username_xyz"}
        )
        assert resp.status_code == 200

    def test_save_with_no_body_still_succeeds(self, client, auth_headers):
        """Saving with an empty body should not crash — no fields get updated."""
        resp = client.post("/profile/save", headers=auth_headers, json={})
        assert resp.status_code == 200
