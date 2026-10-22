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
    # Endpoint browsers can reach for presigned URLs. Inside docker-compose the
    # backend talks to "http://minio:9000", which a browser cannot resolve —
    # set this to the host-visible address (e.g. http://<lab-pc>:9000).
    S3_PUBLIC_ENDPOINT: str = ""
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

    # ── API hardening ─────────────────────────────────────────────────────
    # Comma-separated browser origins allowed by CORS. "*" (dev default)
    # becomes a wildcard without credentials.
    CORS_ORIGINS: str = "*"
    # Geometry upload cap (whole-file, enforced at the API).
    MAX_UPLOAD_MB: int = 256
    # Max queued+running jobs+meshes per user (0 = unlimited).
    MAX_ACTIVE_JOBS_PER_USER: int = 4
    # When set, /auth/register requires this invite code and /auth/guest is
    # disabled. Empty keeps open registration (dev default).
    INVITE_CODE: str = ""
    # Mark a deployment as production: refuses to boot with placeholder
    # secrets and disables auto-reload conveniences.
    ENVIRONMENT: str = "development"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    def validate_production(self) -> list[str]:
        """Return fatal misconfigurations for a production deployment."""
        problems: list[str] = []
        if self.JWT_SECRET in ("change-me-in-production", "dev-secret-change-in-production", ""):
            problems.append("JWT_SECRET is a placeholder — set a random secret")
        if self.S3_SECRET_KEY == "minioadmin":
            problems.append("S3 credentials are the MinIO defaults — change them")
        if self.CORS_ORIGINS.strip() == "*":
            problems.append("CORS_ORIGINS is '*' — set your frontend origin(s)")
        return problems


settings = Settings()
