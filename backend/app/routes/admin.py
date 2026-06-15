"""Endpoints d'administration : stats agrégées et historique des prédictions."""

from collections import Counter
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.db import get_db
from app.models.prediction import Prediction
from app.schemas import (
    AdminStats,
    PredictionHistoryItem,
    StatsDailyPoint,
    StatsKpi,
    StatsScoreBin,
    StatsStatusSlice,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


ACCEPTED_LABELS = {"accordé", "accorde", "accepted", "approved", "1", "versicolor", "virginica"}


def _is_accepted(prediction: str) -> bool:
    return prediction.strip().lower() in ACCEPTED_LABELS


@router.get("/stats", response_model=AdminStats)
def get_stats(db: Session = Depends(get_db)) -> AdminStats:
    all_predictions = db.query(Prediction).all()
    total = len(all_predictions)

    if total == 0:
        return AdminStats(
            kpi=StatsKpi(total=0, accepted_rate=0.0, avg_score=0.0, this_week=0),
            daily=[],
            score_distribution=[],
            status_breakdown=[],
        )

    accepted = sum(1 for p in all_predictions if _is_accepted(p.prediction))
    accepted_rate = round(accepted / total * 100, 1)

    scores = [p.score for p in all_predictions if p.score is not None]
    avg_score = round(sum(scores) / len(scores)) if scores else 0

    one_week_ago = datetime.now(UTC) - timedelta(days=7)
    this_week = sum(1 for p in all_predictions if p.created_at and p.created_at.replace(tzinfo=UTC) > one_week_ago)

    # Daily count — 14 derniers jours
    today = datetime.now(UTC).date()
    fourteen_days_ago = today - timedelta(days=13)
    counts_by_day: dict[str, int] = {}
    for p in all_predictions:
        if p.created_at is None:
            continue
        d = p.created_at.date()
        if d < fourteen_days_ago:
            continue
        key = d.strftime("%d/%m")
        counts_by_day[key] = counts_by_day.get(key, 0) + 1
    daily = []
    for i in range(14):
        d = fourteen_days_ago + timedelta(days=i)
        key = d.strftime("%d/%m")
        daily.append(StatsDailyPoint(day=key, count=counts_by_day.get(key, 0)))

    # Score distribution
    bins = [("0-200", 0, 200), ("200-400", 200, 400), ("400-600", 400, 600), ("600-800", 600, 800), ("800-1000", 800, 1001)]
    score_distribution = []
    for label, lo, hi in bins:
        n = sum(1 for s in scores if lo <= s < hi)
        score_distribution.append(StatsScoreBin(bin=label, n=n))

    # Status breakdown
    status_counter = Counter("Accordé" if _is_accepted(p.prediction) else "Refusé" for p in all_predictions)
    status_breakdown = [StatsStatusSlice(name=k, value=v) for k, v in status_counter.items()]

    return AdminStats(
        kpi=StatsKpi(
            total=total,
            accepted_rate=accepted_rate,
            avg_score=avg_score,
            this_week=this_week,
        ),
        daily=daily,
        score_distribution=score_distribution,
        status_breakdown=status_breakdown,
    )


@router.get("/predictions", response_model=list[PredictionHistoryItem])
def list_predictions(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> list[Prediction]:
    return (
        db.query(Prediction)
        .order_by(Prediction.created_at.desc())
        .limit(limit)
        .all()
    )
