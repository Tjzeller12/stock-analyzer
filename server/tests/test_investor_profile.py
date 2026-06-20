"""
test_investor_profile.py — integration tests for the /profile/investor routes and
the personalization service.

Covers auth guards, the completed=False shell on GET, idempotent upsert (P1),
atomic budget sync (P6/P8), 400 on bad payloads (P5), and the personalization
helpers (bounded context P11, non-destructive suggestion P7, budget bands).
"""
import pytest

from app import db
from app.models import User, InvestorProfile
from app.services.personalization import (
    build_profile_context,
    suggest_default_template,
    budget_band,
    MAX_CONTEXT_CHARS,
)


VALID_PAYLOAD = {
    "answers": {
        "q_market_crash": "buy_more",
        "q_sleep_vs_moonshot": "moonshot",
        "q_windfall": "all_in",
        "q_check_frequency": "never_set_forget",
        "q_loss_tolerance": "down_50",
    },
    "time_horizon_years": 12,
    "budget": 2500,
    "preferred_sectors": ["TECHNOLOGY", "FINANCE"],
}


class TestInvestorAuth:
    def test_get_without_token_401(self, client):
        assert client.get("/profile/investor").status_code == 401

    def test_put_without_token_401(self, client):
        assert client.put("/profile/investor", json=VALID_PAYLOAD).status_code == 401


class TestGetInvestorProfile:
    def test_returns_shell_when_incomplete(self, client, auth_headers):
        resp = client.get("/profile/investor", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["onboarding_completed"] is False
        assert data["preferred_sectors"] == []
        assert "suggested_template" in data


class TestUpsertInvestorProfile:
    def test_put_persists_and_derives(self, client, auth_headers):
        resp = client.put("/profile/investor", headers=auth_headers, json=VALID_PAYLOAD)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["onboarding_completed"] is True
        assert data["risk_tag"] == "Aggressive"
        assert data["risk_tolerance_score"] == pytest.approx(100.0)
        assert data["horizon_tag"] == "Very Long"
        assert data["budget"] == 2500
        assert data["preferred_sectors"] == ["TECHNOLOGY", "FINANCE"]

    def test_put_is_idempotent(self, client, auth_headers, app):
        # The in-memory DB is shared across the session, so count relative to this
        # user's writes: two identical PUTs must add exactly one row, not two (P1).
        with app.app_context():
            before = InvestorProfile.query.count()
        client.put("/profile/investor", headers=auth_headers, json=VALID_PAYLOAD)
        client.put("/profile/investor", headers=auth_headers, json=VALID_PAYLOAD)
        with app.app_context():
            after = InvestorProfile.query.count()
        assert after - before == 1

    def test_put_syncs_user_budget(self, client, auth_headers, app):
        client.put("/profile/investor", headers=auth_headers, json=VALID_PAYLOAD)
        with app.app_context():
            profile = InvestorProfile.query.first()
            user = User.query.filter_by(id=profile.user_id).first()
            assert user.budget == profile.budget == 2500
            assert user.risk_tolerance_score == profile.risk_tolerance_score

    def test_put_rejects_too_many_sectors(self, client, auth_headers):
        # All 7 sectors are allowed; more entries than that (here, with a
        # duplicate) is malformed and must be rejected.
        bad = dict(VALID_PAYLOAD)
        bad["preferred_sectors"] = [
            "TECHNOLOGY",
            "FINANCE",
            "ENERGY & TRANSPORTATION",
            "MANUFACTURING",
            "LIFE SCIENCES",
            "TRADE & SERVICES",
            "REAL ESTATE & CONSTRUCTION",
            "TECHNOLOGY",
        ]
        resp = client.put("/profile/investor", headers=auth_headers, json=bad)
        assert resp.status_code == 400

    def test_put_accepts_all_seven_sectors(self, client, auth_headers):
        ok = dict(VALID_PAYLOAD)
        ok["preferred_sectors"] = [
            "TECHNOLOGY",
            "FINANCE",
            "ENERGY & TRANSPORTATION",
            "MANUFACTURING",
            "LIFE SCIENCES",
            "TRADE & SERVICES",
            "REAL ESTATE & CONSTRUCTION",
        ]
        resp = client.put("/profile/investor", headers=auth_headers, json=ok)
        assert resp.status_code == 200
        assert len(resp.get_json()["preferred_sectors"]) == 7

    def test_put_rejects_unknown_sector(self, client, auth_headers):
        bad = dict(VALID_PAYLOAD)
        bad["preferred_sectors"] = ["FAKE_SECTOR"]
        resp = client.put("/profile/investor", headers=auth_headers, json=bad)
        assert resp.status_code == 400

    def test_partial_update_sectors_preserves_other_fields(self, client, auth_headers):
        """A partial PUT (only sectors) must preserve risk, horizon, and budget."""
        client.put("/profile/investor", headers=auth_headers, json=VALID_PAYLOAD)

        resp = client.put(
            "/profile/investor",
            headers=auth_headers,
            json={"preferred_sectors": ["LIFE SCIENCES"]},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        # Only sectors changed; everything else is untouched.
        assert data["preferred_sectors"] == ["LIFE SCIENCES"]
        assert data["risk_tag"] == "Aggressive"
        assert data["risk_tolerance_score"] == pytest.approx(100.0)
        assert data["horizon_tag"] == "Very Long"
        assert data["budget"] == 2500

    def test_partial_update_budget_only(self, client, auth_headers):
        client.put("/profile/investor", headers=auth_headers, json=VALID_PAYLOAD)
        resp = client.put("/profile/investor", headers=auth_headers, json={"budget": 99})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["budget"] == 99
        assert data["risk_tag"] == "Aggressive"
        assert data["preferred_sectors"] == ["TECHNOLOGY", "FINANCE"]

    def test_partial_update_single_answer_merges(self, client, auth_headers):
        """Updating one answer keeps the others (merge), not reset to neutral."""
        client.put("/profile/investor", headers=auth_headers, json=VALID_PAYLOAD)
        # Flip one answer to the least aggressive; score should drop but stay high
        # because the other four answers are preserved.
        resp = client.put(
            "/profile/investor",
            headers=auth_headers,
            json={"answers": {"q_market_crash": "exit"}},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        # 4 questions at 30 + 1 at 0 = 120/150 = 80.0
        assert data["risk_tolerance_score"] == pytest.approx(80.0)


class TestPersonalizationService:
    def _make_user_with_profile(self, **overrides):
        user = User(username="p_" + overrides.get("suffix", "x"),
                    email=overrides.get("suffix", "x") + "@e.com")
        db.session.add(user)
        db.session.commit()
        profile = InvestorProfile(
            user_id=user.id,
            risk_tolerance_score=overrides.get("score", 82.0),
            risk_tag=overrides.get("risk_tag", "Aggressive"),
            time_horizon_years=12,
            horizon_tag="Very Long",
            budget=overrides.get("budget", 2500.0),
            preferred_sectors=overrides.get("sectors", ["TECHNOLOGY", "FINANCE"]),
            raw_answers={},
            onboarding_completed=overrides.get("completed", True),
        )
        db.session.add(profile)
        db.session.commit()
        return user

    def test_context_is_bounded(self, app):
        with app.app_context():
            user = self._make_user_with_profile(suffix="ctx")
            ctx = build_profile_context(user)
            assert ctx != ""
            assert len(ctx) <= MAX_CONTEXT_CHARS
            assert "Aggressive" in ctx

    def test_context_empty_when_incomplete(self, app):
        with app.app_context():
            user = self._make_user_with_profile(suffix="inc", completed=False)
            assert build_profile_context(user) == ""

    def test_budget_band_buckets(self, app):
        with app.app_context():
            micro = self._make_user_with_profile(suffix="m", budget=100.0)
            standard = self._make_user_with_profile(suffix="s", budget=5000.0)
            high = self._make_user_with_profile(suffix="h", budget=50000.0)
            assert budget_band(micro.investor_profile) == "micro"
            assert budget_band(standard.investor_profile) == "standard"
            assert budget_band(high.investor_profile) == "high"

    def test_suggest_template_returns_copy(self, app):
        with app.app_context():
            user = self._make_user_with_profile(suffix="tpl", risk_tag="Aggressive")
            t1 = suggest_default_template(user.investor_profile)
            t1["equations"]["Growth"] = "MUTATED"
            t2 = suggest_default_template(user.investor_profile)
            # Mutating one result must not leak into the next (non-destructive, P7).
            assert t2["equations"]["Growth"] != "MUTATED"

    def test_suggest_template_unknown_falls_back(self, app):
        with app.app_context():
            template = suggest_default_template(None)
            assert "equations" in template
            assert template["name"]
