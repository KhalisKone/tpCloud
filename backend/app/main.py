"""Point d'entrée de l'API.

`load_dotenv()` charge le fichier .env s'il est trouvé en remontant l'arborescence.
En conteneur (Docker / ECS), il n'y a pas de .env : c'est un no-op, les variables
viennent de l'environnement.
"""

from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from slowapi import _rate_limit_exceeded_handler  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402

from app.db import init_db  # noqa: E402
from app.ml.model import load_model  # noqa: E402
from app.ratelimit import limiter  # noqa: E402
from app.routes import admin, auth, health, items, predict  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    app.state.model = load_model()
    yield


app = FastAPI(title="Projet Cloud - Template 2iE", version="0.2.0", lifespan=lifespan)

# Rate limiting (slowapi)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# /health expose a la racine pour le healthcheck du load balancer (ALB).
# Tout le reste de l'API est servi sous /api/*. Le frontend (nginx) ne
# fait plus de rewrite : il proxie /api/... tel quel vers le backend.
app.include_router(health.router)

app.include_router(health.router, prefix="/api")
app.include_router(items.router, prefix="/api")
app.include_router(predict.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
