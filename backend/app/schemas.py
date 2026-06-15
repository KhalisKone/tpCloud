from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ItemIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    value: float


class ItemOut(ItemIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class PredictIn(BaseModel):
    """Entrée pour /predict.

    Les champs métier (nom, montant, durée) sont optionnels mais recommandés
    pour que l'admin dashboard puisse les afficher.
    """

    features: list[float] = Field(..., min_length=1)
    applicant_name: str | None = None
    amount: float | None = None
    duration_months: int | None = None


class PredictOut(BaseModel):
    prediction: str | int | float
    proba: list[float] | None = None
    score: int | None = None
    id: int | None = None


class PredictionHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    applicant_name: str | None = None
    prediction: str
    score: int | None = None
    amount: float | None = None
    duration_months: int | None = None
    created_at: datetime


class StatsKpi(BaseModel):
    total: int
    accepted_rate: float
    avg_score: float
    this_week: int


class StatsDailyPoint(BaseModel):
    day: str
    count: int


class StatsScoreBin(BaseModel):
    bin: str
    n: int


class StatsStatusSlice(BaseModel):
    name: str
    value: int


class AdminStats(BaseModel):
    kpi: StatsKpi
    daily: list[StatsDailyPoint]
    score_distribution: list[StatsScoreBin]
    status_breakdown: list[StatsStatusSlice]
