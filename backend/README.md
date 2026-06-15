# Backend — Projet Cloud

API FastAPI : CRUD sur des `Items`, inférence ML via `/predict`, et un endpoint `/health`.

## Pré-requis

- Python 3.11+
- [uv](https://docs.astral.sh/uv/)

## Installation

```bash
uv sync
```

`uv sync` lit `pyproject.toml` et `uv.lock` et installe tout dans un venv local.

## Lancer en local (sans Docker)

```bash
uv run uvicorn app.main:app --reload
```

- API : http://localhost:8000
- Swagger : http://localhost:8000/docs

## Tests

```bash
uv run pytest -q
```

## Lint et format

```bash
uv run ruff check .
uv run ruff format .
```

## Variables d'environnement

Voir `.env.example` à la racine du projet (au-dessus de `backend/`).
