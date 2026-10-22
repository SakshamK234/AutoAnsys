"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.auth.router import router as auth_router
from app.api.geometries import router as geometries_router
from app.api.jobs import router as jobs_router
from app.api.meshes import router as meshes_router
from app.api.templates import router as templates_router
from app.api.files import router as files_router
from app.api.cluster import router as cluster_router
from app.api.groups import router as groups_router
from app.api.profiles import router as profiles_router
from app.api.websocket import router as ws_router


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup / shutdown lifecycle."""
    problems = settings.validate_production()
    if settings.ENVIRONMENT == "production" and problems:
        raise RuntimeError(
            "Refusing to start with production misconfiguration:\n- "
            + "\n- ".join(problems)
        )
    for p in problems:
        logger.warning("insecure default (ok for dev, fatal in production): %s", p)
    yield


app = FastAPI(
    title="AutoAnsys",
    version="0.1.0",
    description="CFD Simulation Management Platform",
    lifespan=lifespan,
)

# ── CORS — origins come from CORS_ORIGINS (comma-separated). A wildcard is
# allowed only without credentials, matching browser CORS semantics.
_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(geometries_router)
app.include_router(jobs_router)
app.include_router(meshes_router)
app.include_router(templates_router)
app.include_router(files_router)
app.include_router(cluster_router)
app.include_router(groups_router)
app.include_router(profiles_router)
app.include_router(ws_router)


@app.get("/api/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok"}
