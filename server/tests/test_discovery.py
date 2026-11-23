"""
test_discovery.py — unit + integration tests for the discovery engine (feature 02).

Covers the parser choke point (P2, P6, P10), the generic-fallback prompt (P1),
deterministic refinement sanitizing/cap (P5), cache idempotency (P7), and the
route's auth guard + graceful degradation on malformed model output.
"""
import app.routes.discovery as discovery_route
from app.alphaBot.client import AlphaBotResult
from app.services.discovery import (
    MAX_RECOMMENDATIONS,
    MAX_REFINEMENTS,
    DiscoveryParser,
    SuperPrompt,
    _sanitize_refinements,
    profile_signature,
)


def _valid_json(n=1):
    items = [
        f'{{"ticker":"TICK{i}","company_name":"Company {i}","rationale":"Reason {i}.","sector":"Tech"}}'
        for i in range(n)
    ]
    return "[" + ",".join(items) + "]"


class TestDiscoveryParser:
    def test_parses_clean_array(self):
        recs = DiscoveryParser.parse(
            '[{"ticker":"MSFT","company_name":"Microsoft","rationale":"Strong moat.","sector":"Technology"}]'
        )
        assert len(recs) == 1
        assert recs[0].ticker == "MSFT"
        assert recs[0].sector == "Technology"

    def test_strips_markdown_fences(self):
        recs = DiscoveryParser.parse(
            '```json\n[{"ticker":"AAPL","company_name":"Apple","rationale":"Cash machine."}]\n```'
        )
        assert len(recs) == 1
        assert recs[0].ticker == "AAPL"
        assert recs[0].sector is None

    def test_uppercases_ticker(self):
        recs = DiscoveryParser.parse('[{"ticker":"msft","company_name":"Microsoft","rationale":"x."}]')
        assert recs[0].ticker == "MSFT"

    def test_dedupes_by_ticker(self):
        recs = DiscoveryParser.parse(
            '[{"ticker":"MSFT","company_name":"Microsoft","rationale":"a."},'
            '{"ticker":"MSFT","company_name":"Microsoft Dup","rationale":"b."}]'
        )
        assert len(recs) == 1

    def test_caps_at_max(self):
        recs = DiscoveryParser.parse(_valid_json(MAX_RECOMMENDATIONS + 5))
        assert len(recs) == MAX_RECOMMENDATIONS

    def test_drops_entries_missing_required_fields(self):
        recs = DiscoveryParser.parse(
            '[{"ticker":"","company_name":"NoTicker","rationale":"x."},'
            '{"ticker":"GOOD","company_name":"","rationale":"x."},'
            '{"ticker":"VALID","company_name":"Valid Co","rationale":"ok."}]'
        )
        assert [r.ticker for r in recs] == ["VALID"]

    def test_rejects_invalid_ticker_shapes(self):
        recs = DiscoveryParser.parse(
            '[{"ticker":"123BAD!!","company_name":"Bad","rationale":"x."},'
            '{"ticker":"BRK.B","company_name":"Berkshire","rationale":"ok."}]'
        )
        assert [r.ticker for r in recs] == ["BRK.B"]

    def test_bounds_rationale_to_two_sentences(self):
        recs = DiscoveryParser.parse(
            '[{"ticker":"X","company_name":"X Co","rationale":"One. Two. Three. Four."}]'
        )
        assert recs[0].rationale == "One. Two."

    def test_returns_empty_on_malformed_json(self):
        assert DiscoveryParser.parse("not json at all") == []
        assert DiscoveryParser.parse("") == []
        assert DiscoveryParser.parse(None) == []

    def test_returns_empty_on_non_array_json(self):
        assert DiscoveryParser.parse('{"foo": "bar"}') == []

    def test_tolerates_wrapper_object(self):
        recs = DiscoveryParser.parse(
            '{"recommendations":[{"ticker":"NVDA","company_name":"Nvidia","rationale":"AI."}]}'
        )
        assert len(recs) == 1
        assert recs[0].ticker == "NVDA"


class TestSanitizeRefinements:
    def test_strips_and_drops_empty(self):
        assert _sanitize_refinements(["  hi  ", "", "   ", "yo"]) == ["hi", "yo"]

    def test_caps_count(self):
        out = _sanitize_refinements([f"r{i}" for i in range(MAX_REFINEMENTS + 10)])
        assert len(out) == MAX_REFINEMENTS

    def test_non_list_returns_empty(self):
        assert _sanitize_refinements("nope") == []
        assert _sanitize_refinements(None) == []

    def test_drops_non_strings(self):
        assert _sanitize_refinements(["ok", 5, {"a": 1}, "good"]) == ["ok", "good"]


class TestProfileSignature:
    def test_noprofile_signature_is_stable(self, app):
        class _U:
            investor_profile = None

        assert profile_signature(_U()) == "noprofile"


class TestSuperPromptBuild:
    def test_generic_fallback_when_no_profile(self, app):
        prompt = SuperPrompt.build("", [])
        assert "no saved investor profile" in prompt
        assert "(none" in prompt  # empty refinements block

    def test_includes_profile_and_refinements(self, app):
        prompt = SuperPrompt.build("<investor_profile>risk: Aggressive</investor_profile>", ["Exclude EV"])
        assert "Aggressive" in prompt
        assert "1. Exclude EV" in prompt


class TestGenerateRoute:
    def test_requires_auth(self, client):
        assert client.post("/discovery/generate", json={"refinements": []}).status_code == 401

    def test_generates_recommendations(self, client, auth_headers, monkeypatch):
        def fake_run_sync(prompt, include_tools=False):
            return AlphaBotResult(text=_valid_json(3))

        monkeypatch.setattr(discovery_route.AlphaBotClient, "run_sync", fake_run_sync)
        resp = client.post(
            "/discovery/generate",
            headers=auth_headers,
            json={"refinements": ["unique-refinement-gen"]},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["recommendations"]) == 3
        assert data["generated_from"]["refinement_count"] == 1
        assert data["generated_from"]["has_profile"] is False

    def test_is_cached_within_ttl(self, client, auth_headers, monkeypatch):
        calls = {"n": 0}

        def fake_run_sync(prompt, include_tools=False):
            calls["n"] += 1
            return AlphaBotResult(text=_valid_json(2))

        monkeypatch.setattr(discovery_route.AlphaBotClient, "run_sync", fake_run_sync)
        body = {"refinements": ["unique-refinement-cache"]}
        client.post("/discovery/generate", headers=auth_headers, json=body)
        client.post("/discovery/generate", headers=auth_headers, json=body)
        # Second identical request hits the cache, so Claude is only invoked once.
        assert calls["n"] == 1

    def test_malformed_output_degrades_to_empty_and_not_cached(self, client, auth_headers, monkeypatch):
        calls = {"n": 0}

        def fake_run_sync(prompt, include_tools=False):
            calls["n"] += 1
            return AlphaBotResult(text="this is not json")

        monkeypatch.setattr(discovery_route.AlphaBotClient, "run_sync", fake_run_sync)
        body = {"refinements": ["unique-refinement-empty"]}
        r1 = client.post("/discovery/generate", headers=auth_headers, json=body)
        assert r1.status_code == 200
        assert r1.get_json()["recommendations"] == []
        # Empty results are never cached, so a second call re-invokes Claude.
        client.post("/discovery/generate", headers=auth_headers, json=body)
        assert calls["n"] == 2

    def test_server_caps_refinements(self, client, auth_headers, monkeypatch):
        captured = {}

        def fake_run_sync(prompt, include_tools=False):
            captured["prompt"] = prompt
            return AlphaBotResult(text=_valid_json(1))

        monkeypatch.setattr(discovery_route.AlphaBotClient, "run_sync", fake_run_sync)
        resp = client.post(
            "/discovery/generate",
            headers=auth_headers,
            json={"refinements": [f"r{i}" for i in range(MAX_REFINEMENTS + 5)]},
        )
        assert resp.status_code == 200
        # The (MAX+1)-th refinement must never reach the prompt.
        assert f"{MAX_REFINEMENTS + 1}. r{MAX_REFINEMENTS}" not in captured["prompt"]
