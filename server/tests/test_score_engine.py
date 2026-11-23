"""
test_score_engine.py — pure unit tests for the score engine math.

These tests do NOT touch the database at all. They call
`evaluate_equations` directly with known inputs and verify
the mathematical output precisely.
"""
import pytest
from app.services.score_engine import evaluate_equations


class TestEvaluateEquations:
    """Tests for the sandboxed math equation evaluator."""

    def test_simple_arithmetic_scores_correctly(self):
        """A variable equal to 0.5 scaled by 100 should produce 50.0."""
        equations = {"Valuation": "x"}
        variables = {"x": 0.5}
        result = evaluate_equations(equations, variables)
        assert result["Valuation"] == pytest.approx(50.0)

    def test_perfect_score_is_100(self):
        """A variable of 1.0 should produce exactly 100."""
        equations = {"Category": "x"}
        variables = {"x": 1.0}
        result = evaluate_equations(equations, variables)
        assert result["Category"] == pytest.approx(100.0)

    def test_score_clamped_at_zero_floor(self):
        """Negative raw values should be clamped at 0, not go negative."""
        equations = {"Category": "x"}
        variables = {"x": -5.0}
        result = evaluate_equations(equations, variables)
        assert result["Category"] == pytest.approx(0.0)

    def test_score_clamped_at_100_ceiling(self):
        """Values greater than 1.0 (scaled > 100) should be clamped at 100."""
        equations = {"Category": "x"}
        variables = {"x": 999.0}
        result = evaluate_equations(equations, variables)
        assert result["Category"] == pytest.approx(100.0)

    def test_multi_variable_weighted_equation(self):
        """Weighted multi-variable equations should compute correctly."""
        # 0.6 * 0.8 + 0.4 * 0.5 = 0.48 + 0.20 = 0.68  → * 100 = 68.0
        equations = {"Composite": "n_a * 0.6 + n_b * 0.4"}
        variables = {"n_a": 0.8, "n_b": 0.5}
        result = evaluate_equations(equations, variables)
        assert result["Composite"] == pytest.approx(68.0, rel=1e-3)

    def test_caret_is_exponentiation_not_xor(self):
        """
        The editor previews with mathjs, where `^` means power. Python would read
        it as XOR and fail, silently zeroing the axis, so it is translated first.
        """
        variables = {"roe": 0.5, "roa": 0.5}
        assert evaluate_equations({"A": "roe ^ 2"}, variables)["A"] == pytest.approx(25.0)
        # `**` keeps working, and the two agree.
        assert evaluate_equations({"A": "roe ** 2"}, variables)["A"] == pytest.approx(25.0)
        assert evaluate_equations({"A": "0.5 * roe ^ 2 + 0.5 * roa"}, variables)["A"] == pytest.approx(37.5)

    def test_invalid_equation_returns_zero(self):
        """A completely invalid equation string should return 0.0, not raise."""
        equations = {"Bad": "undefined_var + !!!"}
        variables = {}
        result = evaluate_equations(equations, variables)
        assert result["Bad"] == pytest.approx(0.0)

    def test_multiple_categories_evaluated_independently(self):
        """Each category in the dict should be evaluated independently."""
        equations = {"A": "x", "B": "y"}
        variables = {"x": 0.25, "y": 0.75}
        result = evaluate_equations(equations, variables)
        assert result["A"] == pytest.approx(25.0)
        assert result["B"] == pytest.approx(75.0)

    def test_z_scores_are_recentred_by_the_formula(self):
        """
        There is no z-score mode any more: an equation always returns 0-1.
        A formula wanting distance-from-average re-centres it itself, and an
        average stock (z = 0) lands on 50.
        """
        equations = {"Category": "(z_x + 3) / 6"}
        result = evaluate_equations(equations, {"z_x": 0.0})
        assert result["Category"] == pytest.approx(50.0)
        # +1 sigma sits proportionally above it, and extremes still clamp.
        assert evaluate_equations(equations, {"z_x": 1.0})["Category"] == pytest.approx(66.67, rel=1e-3)
        assert evaluate_equations(equations, {"z_x": 99.0})["Category"] == pytest.approx(100.0)
