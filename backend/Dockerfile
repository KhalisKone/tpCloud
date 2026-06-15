# Image de base figee par digest pour reproductibilite (le tag :3.11-slim-bookworm
# bouge dans le temps). Mettre a jour periodiquement en re-pinnant le nouveau sha.
FROM python:3.11-slim-bookworm@sha256:cd67330292a51e2963156f74ff340455d66b2172e9190e99f40dff9357471177

# upgrade : recupere les patches de securite OS publies apres la derniere
# republication de l'image de base (sinon Trivy bloque sur des CVE deja
# corrigees en amont, ex. libgnutls30).
RUN apt-get update \
    && apt-get -y upgrade \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# uv pinne par version + digest (l'image officielle Astral est immutable par tag,
# mais le digest fige aussi la couche en cas de re-tag accidentel).
COPY --from=ghcr.io/astral-sh/uv:0.11.2@sha256:c4f5de312ee66d46810635ffc5df34a1973ba753e7241ce3a08ef979ddd7bea5 /uv /uvx /usr/local/bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH" \
    PORT=8000 \
    PYTHONUNBUFFERED=1

RUN useradd -m appuser
WORKDIR /app

COPY --chown=appuser pyproject.toml uv.lock* README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY --chown=appuser app/ ./app/
COPY --chown=appuser tests/ ./tests/

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

RUN mkdir -p /app/models && chown -R appuser:appuser /app/models

USER appuser

EXPOSE ${PORT}
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -fsS http://localhost:${PORT}/health || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
