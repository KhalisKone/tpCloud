"""Entraîne le modèle MicroScore et sauvegarde un artefact joblib."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import joblib
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.ml.credit_model import FEATURE_NAMES, generate_training_data, train_credit_model  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Entraîner le modèle de scoring crédit MicroScore.")
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "backend" / "models" / "model.pkl",
        help="Chemin de sortie du modèle joblib.",
    )
    parser.add_argument("--samples", type=int, default=900, help="Nombre d'exemples synthétiques.")
    parser.add_argument("--seed", type=int, default=42, help="Graine aléatoire.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model = train_credit_model(n_samples=args.samples, seed=args.seed)

    X, y = generate_training_data(n_samples=args.samples, seed=args.seed)
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=args.seed,
        stratify=y,
    )
    model.fit(X_train, y_train)
    accuracy = accuracy_score(y_test, model.predict(X_test))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, args.output)

    print(f"Modèle sauvegardé : {args.output}")
    print(f"Accuracy validation : {accuracy:.3f}")
    print("Features attendues :")
    for index, name in enumerate(FEATURE_NAMES, start=1):
        print(f"{index}. {name}")


if __name__ == "__main__":
    main()
