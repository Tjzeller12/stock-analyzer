"""Analysis templates: starters, ownership, ranking quality."""
from types import SimpleNamespace

from app.constants import RADAR_METRICS
from app.models import AnalysisTemplate
from app.services.score_engine import calculate_compare_scores
from app.services.template_seed import DEFAULT_TEMPLATES, seed_default_templates


def _stock(symbol, **fields):
    data = {m: 1.0 for m in RADAR_METRICS}
    data.update(fields)
    data["symbol"] = symbol
    data["sector"] = "Technology"
    return SimpleNamespace(**data)


# Durable compounder vs high-beta grower. Conservative should prefer QUALITY;
# Aggressive should prefer SPEC.
QUALITY = _stock(
    "QUALITY",
    beta=0.45,
    debt_to_equity=0.25,
    dividend_yield=0.038,
    forward_pe=16.0,
    ev_to_ebitda=10.0,
    price_to_fc=18.0,
    pe_ratio=18.0,
    roe=0.22,
    roa=0.10,
    profit_margin=0.18,
    roic=0.16,
    eps_growth_qoq=0.04,
    rev_growth_qoq=0.03,
    peg_ratio=1.4,
    price_to_sales=3.0,
    ai_moat_score=82.0,
    ai_news_score=40.0,
)
SPEC = _stock(
    "SPEC",
    beta=2.1,
    debt_to_equity=2.8,
    dividend_yield=0.0,
    forward_pe=55.0,
    ev_to_ebitda=32.0,
    price_to_fc=48.0,
    pe_ratio=60.0,
    roe=0.08,
    roa=0.02,
    profit_margin=0.04,
    roic=0.05,
    eps_growth_qoq=0.42,
    rev_growth_qoq=0.38,
    peg_ratio=2.8,
    price_to_sales=12.0,
    ai_moat_score=28.0,
    ai_news_score=88.0,
)


def _avg(score_map):
    return sum(score_map.values()) / len(score_map)


def _radar_of(tag):
    spec = next(s for s in DEFAULT_TEMPLATES if s["profile_risk_tag"] == tag)
    return spec["config"]["radar"]


class TestTemplateSeed:
    def test_seed_is_idempotent(self, app):
        with app.app_context():
            seed_default_templates()
            seed_default_templates()
            rows = AnalysisTemplate.query.filter_by(is_default=True).all()
            assert len(rows) == 4
            tags = {r.profile_risk_tag for r in rows}
            assert tags == {"Conservative", "Balanced", "Growth", "Aggressive"}

    def test_conservative_ranks_quality_above_spec(self, app):
        with app.app_context():
            scores = calculate_compare_scores(
                [QUALITY, SPEC], _radar_of("Conservative"), is_relative=True
            )
            assert _avg(scores["QUALITY"]) > _avg(scores["SPEC"])

    def test_aggressive_ranks_spec_above_quality(self, app):
        with app.app_context():
            scores = calculate_compare_scores(
                [QUALITY, SPEC], _radar_of("Aggressive"), is_relative=True
            )
            assert _avg(scores["SPEC"]) > _avg(scores["QUALITY"])


class TestTemplateRoutes:
    def test_list_includes_starters(self, client, auth_headers, app):
        with app.app_context():
            resp = client.get("/templates", headers=auth_headers)
            assert resp.status_code == 200
            body = resp.get_json()
            assert len(body["defaults"]) == 4
            names = {row["name"] for row in body["defaults"]}
            assert names == {
                "Stability First",
                "Balanced Core",
                "Growth Tilt",
                "High Conviction Growth",
            }
            assert body["mine"] == []

    def test_create_and_list_mine(self, client, auth_headers, app):
        starter = client.get("/templates", headers=auth_headers).get_json()["defaults"][0]
        payload = {
            "name": "My Screen",
            "description": "tweaked",
            "config": starter["config"],
        }
        created = client.post("/templates", json=payload, headers=auth_headers)
        assert created.status_code == 201
        listed = client.get("/templates", headers=auth_headers).get_json()
        assert len(listed["mine"]) == 1
        assert listed["mine"][0]["name"] == "My Screen"
        assert listed["mine"][0]["is_owner"] is True

    def test_cannot_delete_default(self, client, auth_headers):
        starter = client.get("/templates", headers=auth_headers).get_json()["defaults"][0]
        resp = client.delete(f"/templates/{starter['id']}", headers=auth_headers)
        assert resp.status_code == 403

    def test_cannot_edit_default(self, client, auth_headers):
        starter = client.get("/templates", headers=auth_headers).get_json()["defaults"][0]
        resp = client.put(
            f"/templates/{starter['id']}",
            json={"name": "hacked"},
            headers=auth_headers,
        )
        assert resp.status_code == 403

    def test_owner_can_rename_and_redescribe(self, client, auth_headers):
        starter = client.get("/templates", headers=auth_headers).get_json()["defaults"][0]
        created = client.post(
            "/templates",
            json={"name": "temp", "description": "old notes", "config": starter["config"]},
            headers=auth_headers,
        ).get_json()
        resp = client.put(
            f"/templates/{created['id']}",
            json={"name": "Dividend screen", "description": "Income focus"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["name"] == "Dividend screen"
        assert body["description"] == "Income focus"

    def test_clone_default_is_owned(self, client, auth_headers):
        starter = client.get("/templates", headers=auth_headers).get_json()["defaults"][0]
        cloned = client.post(f"/templates/{starter['id']}/clone", headers=auth_headers)
        assert cloned.status_code == 201
        body = cloned.get_json()
        assert body["is_default"] is False
        assert body["is_owner"] is True
        assert body["id"] != starter["id"]

    def test_owner_can_delete_own(self, client, auth_headers):
        starter = client.get("/templates", headers=auth_headers).get_json()["defaults"][0]
        created = client.post(
            "/templates",
            json={"name": "temp", "config": starter["config"]},
            headers=auth_headers,
        ).get_json()
        resp = client.delete(f"/templates/{created['id']}", headers=auth_headers)
        assert resp.status_code == 200
        listed = client.get("/templates", headers=auth_headers).get_json()
        assert listed["mine"] == []

    def test_rejects_bad_config(self, client, auth_headers):
        resp = client.post(
            "/templates",
            json={"name": "bad", "config": {"radar": {"equations": {"A": "1"}}}},
            headers=auth_headers,
        )
        assert resp.status_code == 400
