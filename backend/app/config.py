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

    # ── HPC Cluster ───────────────────────────────────────────────────────
    CLUSTER_HOST: str = "localhost"
    CLUSTER_PORT: int = 22
    CLUSTER_USER: str = "cfd"
    CLUSTER_KEY_PATH: str = "~/.ssh/id_rsa"
    CLUSTER_WORKSPACE_BASE: str = "/scratch/cfd/jobs"
    CLUSTER_MOCK_MODE: bool = True

    # ── ANSYS / Fluent ────────────────────────────────────────────────────
    FLUENT_MODULE: str = "ansys/2024r2"

    # ── Polling ───────────────────────────────────────────────────────────
    JOB_POLL_INTERVAL: int = 30

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
