import math
from dataclasses import dataclass
from typing import Literal

SCORE_FLOOR = 50

Reason = Literal[
    "low_score",
    "no_score",
    "no_sector",
    "no_price",
    "too_expensive",
    "sector_full",
    "sector_not_funded",
]

Split = Literal["equal", "score_based", "top_heavy"]


@dataclass(frozen=True)
class CandidateStock:
    symbol: str
    price: float | None
    radar_score: float | None
    sector: str | None


@dataclass(frozen=True)
class SectorTarget:
    sector: str
    percent_of_budget: float
    max_stock_count: int | None


@dataclass(frozen=True)
class AllocationLine:
    symbol: str
    sector: str
    radar_score: float
    price: float
    target: float
    shares: int
    total_cost: float


@dataclass(frozen=True)
class SkippedName:
    symbol: str
    sector: str | None
    radar_score: float | None
    price: float | None
    reason: Reason


@dataclass(frozen=True)
class SectorResult:
    sector: str
    target_percent: float
    actual_percent: float
    target_dollars: float
    total_dollars: float


@dataclass(frozen=True)
class DiversityControls:
    sector_targets: tuple[SectorTarget, ...]
    budget: float
    split: Split = "score_based"


@dataclass(frozen=True)
class AllocationPlan:
    budget: float
    lines: tuple[AllocationLine, ...]
    skipped: tuple[SkippedName, ...]
    sector_results: tuple[SectorResult, ...]
    leftover_cash: float


def get_skipped_reason(candidate_stock: CandidateStock, score_floor: float) -> Reason | None:
    """Why this stock can't be bought at all, or None if it can.

    Checks run in a fixed order (price, sector, score), so a stock with
    several problems always gets the same reason.
    """
    if candidate_stock.price is None or candidate_stock.price <= 0:
        return "no_price"
    if not candidate_stock.sector:
        return "no_sector"
    if candidate_stock.radar_score is None or math.isnan(candidate_stock.radar_score):
        return "no_score"
    if candidate_stock.radar_score <= score_floor:
        return "low_score"
    return None


def get_eligible_candidates(
    candidate_stocks: tuple[CandidateStock, ...], score_floor: float
) -> tuple[dict[str, list[CandidateStock]], tuple[SkippedName, ...]]:
    """Split candidates into buyable names grouped by sector, and skipped names.

    Names keep their input order inside a sector; seating sorts them.
    """
    if math.isnan(score_floor) or not 0 <= score_floor <= 100:
        raise ValueError(f"score_floor must be between 0 and 100, got {score_floor}")

    skipped_names: list[SkippedName] = []
    eligible_candidates: dict[str, list[CandidateStock]] = {}

    for candidate_stock in candidate_stocks:
        reason = get_skipped_reason(candidate_stock, score_floor)
        if reason is not None:
            skipped_names.append(
                SkippedName(
                    candidate_stock.symbol,
                    candidate_stock.sector,
                    candidate_stock.radar_score,
                    candidate_stock.price,
                    reason,
                )
            )
            continue
        eligible_candidates.setdefault(candidate_stock.sector, []).append(candidate_stock)

    return eligible_candidates, tuple(skipped_names)
