"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration sourced from .env / environment."""

    # ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/autoansys"

    # ── Redis / Celery ────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── S3 / MinIO ────────────────────────────────────────────────────────
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "autoansys"

    # ── JWT ────────────────────────────────────────────────────────────────
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── HPC Cluster (override all via .env — defaults are public-repo placeholders)
    CLUSTER_HOST: str = "cluster-login.example.edu"
    CLUSTER_PORT: int = 22
    CLUSTER_USER: str = "your_netid"
    CLUSTER_KEY_PATH: str = "~/.ssh/id_cluster"
    CLUSTER_WORKSPACE_BASE: str = "/scratch/your_netid/autoansys/jobs"
    CLUSTER_ACCOUNT: str = "your_slurm_account"
    CLUSTER_MOCK_MODE: bool = True

    # ── ANSYS / Fluent ────────────────────────────────────────────────────
    FLUENT_MODULE: str = "ANSYS/2025R1"

    # ── Reproducibility ───────────────────────────────────────────────────
    # App git SHA, set at container build time (e.g. ARG GIT_SHA in the Dockerfile)
    # and recorded in each run's run_metadata.json. "unknown" when not provided.
    GIT_SHA: str = "unknown"

    # ── Polling ───────────────────────────────────────────────────────────
    JOB_POLL_INTERVAL: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
