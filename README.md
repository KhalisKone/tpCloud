# EnergyScore — Prédiction de charge énergétique de bâtiments

Groupe : KONE M'PIE AIMAN KHALIS RAKINE & Andriampitahiana Mamy Herin'Ny Avo RABESIAKA  
Master IA — 2iE — Juin 2026

## Lancement local

```bash
cp .env.example .env
docker compose up --build
```

Ouvrir http://localhost:5173

## Stack

- **Frontend** : React + Vite + nginx
- **Backend** : FastAPI + PostgreSQL + Gradient Boosting (scikit-learn)
- **Dataset** : UCI Energy Efficiency — 768 bâtiments, 8 features architecturales
- **CI/CD** : GitHub Actions (trufflehog + pip-audit + pytest + Trivy + DockerHub push)

## Docs

- [Livrable 1](docs/livrable1/rapport-livrable1.pdf) — Plan sécurité & budget
- [Livrable 2](docs/livrable2/rapport-livrable2.pdf) — Rapport technique
- [Notebook entraînement](notebooks/energie_model.ipynb)
