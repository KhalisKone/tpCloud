"""Chargement du modèle ML.

Trois modes, dans l'ordre de priorité :

1. Si MODEL_S3_BUCKET est défini → télécharger depuis S3 (mode prod)
2. Si MODEL_PATH existe en local → charger depuis le disque (mode dev avec modèle réel)
3. Sinon → entraîner un modèle crédit de démo à la volée (mode démo)
"""

import logging
import os
from pathlib import Path

import joblib

from app.ml.credit_model import EXPECTED_FEATURE_COUNT, train_credit_model

logger = logging.getLogger(__name__)

MODEL_PATH = Path(os.getenv("MODEL_PATH", "models/model.pkl"))
MODEL_S3_BUCKET = os.getenv("MODEL_S3_BUCKET")
MODEL_S3_KEY = os.getenv("MODEL_S3_KEY", "model.pkl")
AWS_REGION = os.getenv("AWS_REGION", "eu-west-1")


def _download_from_s3() -> None:
    """Télécharge le modèle depuis S3 vers MODEL_PATH."""
    import boto3

    logger.info("Téléchargement du modèle depuis s3://%s/%s", MODEL_S3_BUCKET, MODEL_S3_KEY)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    s3 = boto3.client("s3", region_name=AWS_REGION)
    s3.download_file(MODEL_S3_BUCKET, MODEL_S3_KEY, str(MODEL_PATH))
    logger.info("Modèle téléchargé vers %s", MODEL_PATH)


def _feature_count(model) -> int | None:
    return getattr(model, "n_features_in_", None)


def _train_credit_fallback():
    """Entraîne un classifieur crédit de démo et le sauvegarde."""
    logger.warning("Aucun modèle crédit compatible disponible, entraînement du fallback MicroScore")
    clf = train_credit_model()
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf, MODEL_PATH)
    return clf


def load_model():
    """Charge le modèle selon le mode de priorité."""
    if MODEL_S3_BUCKET:
        _download_from_s3()

    if MODEL_PATH.exists():
        model = joblib.load(MODEL_PATH)
        n_features = _feature_count(model)
        if n_features in (None, EXPECTED_FEATURE_COUNT):
            return model
        if MODEL_S3_BUCKET:
            raise ValueError(
                f"Le modèle S3 attend {n_features} features, "
                f"mais MicroScore en fournit {EXPECTED_FEATURE_COUNT}."
            )
        logger.warning(
            "Modèle local incompatible (%s features au lieu de %s), régénération du fallback",
            n_features,
            EXPECTED_FEATURE_COUNT,
        )

    return _train_credit_fallback()
