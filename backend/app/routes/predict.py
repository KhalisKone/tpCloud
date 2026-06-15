"""Endpoint d'inférence générique.

Adapte automatiquement le format de sortie selon le type de modèle (classif vs
régression). Persiste chaque prédiction en base pour l'admin dashboard.

Rate limiting : /predict est plafonné par IP pour limiter le model stealing
(clonage du modèle par envoi massif de requêtes).
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.ml.credit_model import LABELS
from app.models.prediction import Prediction
from app.models.user import User
from app.ratelimit import limiter
from app.schemas import PredictIn, PredictOut

router = APIRouter(prefix="/predict", tags=["ml"])


@router.post("", response_model=PredictOut)
@limiter.limit("20/minute")
def predict(
    payload: PredictIn,
    request: Request,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> PredictOut:
    model = request.app.state.model

    try:
        X = [payload.features]
        proba_list: list[float] | None = None
        score: int | None = None

        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X)[0]
            idx = int(proba.argmax())
            label = LABELS[idx] if idx < len(LABELS) else str(idx)
            proba_list = proba.tolist()
            # Score = proba de la classe positive (dernière) normalisée sur 1000
            score = int(proba_list[-1] * 1000) if len(proba_list) >= 2 else int(max(proba_list) * 1000)
            prediction_str = label
        else:
            pred = model.predict(X)[0]
            prediction_str = str(float(pred))

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Le modèle a refusé l'input : {exc}. Vérifiez le nombre de features.",
        ) from exc

    record = Prediction(
        applicant_name=payload.applicant_name,
        features=payload.features,
        prediction=prediction_str,
        score=score,
        proba=proba_list,
        amount=payload.amount,
        duration_months=payload.duration_months,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return PredictOut(
        prediction=prediction_str,
        proba=proba_list,
        score=score,
        id=record.id,
    )
