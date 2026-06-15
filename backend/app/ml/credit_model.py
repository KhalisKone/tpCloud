"""Modèle de prédiction de charge énergétique (bâtiment)."""

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

FEATURE_NAMES = [
    "compacite_relative",
    "surface_totale",
    "surface_murs",
    "surface_toit",
    "hauteur",
    "orientation",
    "surface_vitrage",
    "distribution_vitrage",
]
EXPECTED_FEATURE_COUNT = len(FEATURE_NAMES)
LABELS = []  # régression — pas de classes


def generate_training_data(n_samples: int = 768, seed: int = 42):
    """Génère des données synthétiques de bâtiments pour le fallback."""
    rng = np.random.default_rng(seed)
    compacite   = rng.choice([0.62, 0.64, 0.66, 0.74, 0.76, 0.82, 0.86, 0.98], n_samples)
    surface     = rng.choice([514.5, 563.5, 612.5, 661.5, 710.5, 759.5, 808.5], n_samples)
    murs        = rng.choice([245.0, 269.5, 294.0, 318.5, 343.0, 367.5, 416.5], n_samples)
    toit        = rng.choice([110.25, 122.5, 147.0, 220.5], n_samples)
    hauteur     = rng.choice([3.5, 7.0], n_samples)
    orientation = rng.choice([2, 3, 4, 5], n_samples)
    vitrage     = rng.choice([0.0, 0.1, 0.25, 0.4], n_samples)
    distrib     = rng.choice([0, 1, 2, 3, 4, 5], n_samples)

    X = np.column_stack([compacite, surface, murs, toit, hauteur, orientation, vitrage, distrib])
    # Formule approchée issue de la régression sur le dataset UCI
    y = (
        -26.0 * compacite
        + 0.05 * surface
        - 0.02 * murs
        - 0.03 * toit
        + 4.5  * hauteur
        + 20.0 * vitrage
        + 10.0
        + rng.normal(0, 1.5, n_samples)
    )
    return X.tolist(), y.tolist()


def train_credit_model(n_samples: int = 768, seed: int = 42):
    """Entraîne un régresseur énergie de fallback (si model.pkl absent)."""
    X, y = generate_training_data(n_samples=n_samples, seed=seed)
    model = make_pipeline(
        StandardScaler(),
        GradientBoostingRegressor(n_estimators=100, random_state=seed),
    )
    model.fit(X, y)
    return model
