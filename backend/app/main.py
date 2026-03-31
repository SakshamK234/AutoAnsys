"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.api.geometries import router as geometries_router
from app.api.jobs import router as jobs_router
from app.api.templates import router as templates_router
from app.api.files import router as files_router
from app.api.cluster import router as cluster_router
from app.api.websocket import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup / shutdown lifecycle."""
    # TODO: initialise connection pools, warm caches, etc.
    yield
    # TODO: close connection pools, flush buffers, etc.


app = FastAPI(
    title="AutoAnsys",
    version="0.1.0",
    description="CFD Simulation Management Platform",
    lifespan=lifespan,
)

# ── CORS (permissive for development) ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(geometries_router)
app.include_router(jobs_router)
app.include_router(templates_router)
app.include_router(files_router)
app.include_router(cluster_router)
app.include_router(ws_router)


@app.get("/api/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok"}
