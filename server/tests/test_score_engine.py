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
        result = evaluate_equations(equations, variables, normalization_method="min-max")
        assert result["Valuation"] == pytest.approx(50.0)

    def test_perfect_score_is_100(self):
        """A variable of 1.0 should produce exactly 100."""
        equations = {"Category": "x"}
        variables = {"x": 1.0}
        result = evaluate_equations(equations, variables, normalization_method="min-max")
        assert result["Category"] == pytest.approx(100.0)

    def test_score_clamped_at_zero_floor(self):
        """Negative raw values should be clamped at 0, not go negative."""
        equations = {"Category": "x"}
        variables = {"x": -5.0}
        result = evaluate_equations(equations, variables, normalization_method="min-max")
        assert result["Category"] == pytest.approx(0.0)

    def test_score_clamped_at_100_ceiling(self):
        """Values greater than 1.0 (scaled > 100) should be clamped at 100."""
        equations = {"Category": "x"}
        variables = {"x": 999.0}
        result = evaluate_equations(equations, variables, normalization_method="min-max")
        assert result["Category"] == pytest.approx(100.0)

    def test_multi_variable_weighted_equation(self):
        """Weighted multi-variable equations should compute correctly."""
        # 0.6 * 0.8 + 0.4 * 0.5 = 0.48 + 0.20 = 0.68  → * 100 = 68.0
        equations = {"Composite": "n_a * 0.6 + n_b * 0.4"}
        variables = {"n_a": 0.8, "n_b": 0.5}
        result = evaluate_equations(equations, variables, normalization_method="min-max")
        assert result["Composite"] == pytest.approx(68.0, rel=1e-3)

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
        result = evaluate_equations(equations, variables, normalization_method="min-max")
        assert result["A"] == pytest.approx(25.0)
        assert result["B"] == pytest.approx(75.0)

    def test_z_score_normalization_method(self):
        """Z-score path: raw_score=0.0 → (0.0 + 3.0) * 16.67 = 50.01"""
        equations = {"Category": "x"}
        variables = {"x": 0.0}
        result = evaluate_equations(equations, variables, normalization_method="z-score")
        # (0.0 + 3.0) * 16.67 = 50.01
        assert result["Category"] == pytest.approx(50.01, rel=1e-2)
