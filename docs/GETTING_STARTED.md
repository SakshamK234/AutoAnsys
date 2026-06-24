# AutoAnsys — Getting Started

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose v2+
- [Node.js 20+](https://nodejs.org/) (only for local frontend dev outside Docker)
- [Python 3.12+](https://www.python.org/) (only for local backend dev outside Docker)

---

## Quick Start (Docker Compose)

This is the recommended way to run the full stack locally.

### 1. Clone and configure

```bash
cd AutoAnsys
cp .env.example .env
```

Out of the box, **`CLUSTER_MOCK_MODE`** defaults to **`true`** in Docker Compose so you can use the UI without a real HPC login. Cluster-related values in `.env.example` are **placeholders** (`your_netid`, `cluster-login.example.edu`, etc.) — replace them when you connect to your site’s cluster. For real SSH submission from Docker, uncomment the SSH key volume lines in `docker-compose.yml` and set `CLUSTER_SSH_KEY_HOST_PATH` (see `.env.example`).

### 2. Start everything

```bash
docker compose up --build
```

This starts **7 services**:

| Service | Port | Description |
|---------|------|-------------|
| **frontend** | [localhost:3000](http://localhost:3000) | React app (Vite dev server) |
| **backend** | [localhost:8000](http://localhost:8000) | FastAPI server |
| **postgres** | localhost:5432 | PostgreSQL 16 database |
| **redis** | localhost:6379 | Celery broker + cache |
| **minio** | [localhost:9000](http://localhost:9000) (API) / [localhost:9001](http://localhost:9001) (console) | S3-compatible object storage |
| **celery-worker** | — | Background task worker |
| **celery-beat** | — | Periodic task scheduler |

On first startup, the backend automatically runs `alembic upgrade head` to create all database tables.

### 3. Verify it's working

- **Backend health check:** `curl http://localhost:8000/api/health`
- **Frontend:** Open [http://localhost:3000](http://localhost:3000) in your browser
- **MinIO console:** Open [http://localhost:9001](http://localhost:9001) (login: `minioadmin` / `minioadmin`)

### 4. Create your first account

Navigate to [http://localhost:3000/login](http://localhost:3000/login) and register a new account. The first user is created as a `member` role by default.

---

## Local Development (without Docker)

If you prefer running services individually for faster iteration:

### Backend

```bash
cd backend

# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables (or use a .env file)
export DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/autoansys
export REDIS_URL=redis://localhost:6379/0
export S3_ENDPOINT=http://localhost:9000
export S3_ACCESS_KEY=minioadmin
export S3_SECRET_KEY=minioadmin
export S3_BUCKET=autoansys
export JWT_SECRET=dev-secret-change-in-production

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

You still need PostgreSQL, Redis, and MinIO running — easiest way is to start just those via Docker:

```bash
docker compose up postgres redis minio minio-init
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The Vite dev server starts at [http://localhost:5173](http://localhost:5173) by default. The API proxy is configured to forward `/api` requests to `localhost:8000`.

### Celery Worker (optional, for background tasks)

```bash
cd backend
source venv/bin/activate

# Worker
celery -A app.tasks.celery_app worker --loglevel=info

# Beat scheduler (in a separate terminal)
celery -A app.tasks.celery_app beat --loglevel=info
```

---

## Project Structure

```
AutoAnsys/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI route handlers
│   │   ├── auth/           # JWT authentication
│   │   ├── cluster/        # SSH/SFTP/SLURM integration
│   │   ├── journal/        # Jinja2 templates for Fluent journals
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic layer
│   │   ├── tasks/          # Celery background tasks
│   │   ├── utils/          # Sanitization helpers
│   │   ├── config.py       # Settings from environment
│   │   ├── database.py     # Async DB engine + session
│   │   └── main.py         # FastAPI app entry point
│   ├── alembic/            # Database migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── entrypoint.sh
├── frontend/
│   ├── src/
│   │   ├── components/     # UI components (wizard, dashboard, jobs, layout)
│   │   ├── hooks/          # React Query hooks (useJobs, useGeometries)
│   │   ├── lib/            # API client, constants, utilities
│   │   ├── pages/          # Route pages
│   │   ├── stores/         # Zustand auth store
│   │   └── types/          # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## API Endpoints

Base URL: `http://localhost:8000/api`

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create a new account |
| POST | `/auth/login` | Login, returns JWT tokens |
| GET | `/auth/me` | Get current user profile |

### Geometries
| Method | Path | Description |
|--------|------|-------------|
| POST | `/geometries/upload` | Upload a geometry file (multipart) |
| GET | `/geometries` | List all geometries |
| GET | `/geometries/{id}` | Get geometry details |
| DELETE | `/geometries/{id}` | Delete a geometry |

### Jobs
| Method | Path | Description |
|--------|------|-------------|
| POST | `/jobs` | Create a new simulation job |
| GET | `/jobs` | List jobs (with status/search filters) |
| GET | `/jobs/{id}` | Get job details |
| POST | `/jobs/{id}/submit` | Submit job to HPC cluster |
| POST | `/jobs/{id}/cancel` | Cancel a running job |
| GET | `/jobs/{id}/forces` | Get force coefficient data |
| GET | `/jobs/{id}/residuals` | Get residual convergence data |

### Templates
| Method | Path | Description |
|--------|------|-------------|
| POST | `/templates` | Create a simulation template |
| GET | `/templates` | List templates |
| GET | `/templates/{id}` | Get template details |
| PUT | `/templates/{id}` | Update a template |
| DELETE | `/templates/{id}` | Delete a template |

---

## Security (public or shared deployments)

- **Never commit** `.env`, SSH private keys, or real cluster passwords.
- **Change** `JWT_SECRET` and any default database / MinIO credentials before exposing the stack beyond localhost.
- **Review** `git log` if this repo was ever private with real secrets; rotate any keys that may have been committed.
- **ANSYS Fluent** requires your own license; this project does not distribute ANSYS software.

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description | Example / default |
|----------|-------------|-------------------|
| `DATABASE_URL` | PostgreSQL connection (asyncpg) | `postgresql+asyncpg://postgres:postgres@postgres:5432/autoansys` |
| `REDIS_URL` | Redis connection | `redis://redis:6379/0` |
| `S3_ENDPOINT` | MinIO/S3 endpoint | `http://minio:9000` |
| `S3_ACCESS_KEY` | S3 access key | `minioadmin` (dev only) |
| `S3_SECRET_KEY` | S3 secret key | `minioadmin` (dev only) |
| `S3_BUCKET` | S3 bucket name | `autoansys` |
| `JWT_SECRET` | Secret for signing JWTs | Set a long random string |
| `CLUSTER_MOCK_MODE` | Skip real SSH (`true` recommended for first run) | `true` |
| `CLUSTER_HOST` | HPC login node hostname | `cluster-login.example.edu` |
| `CLUSTER_USER` | SSH username for cluster | `your_netid` |
| `CLUSTER_WORKSPACE_BASE` | Scratch path for job workspaces | `/scratch/your_netid/autoansys/jobs` |
| `CLUSTER_ACCOUNT` | Default SLURM account in API defaults | `your_slurm_account` |
| `CLUSTER_KEY_PATH` | Path to SSH private key (in container or host) | `/root/.ssh/id_cluster` |

---


## Common Commands

```bash
# Rebuild after dependency changes
docker compose up --build

# View logs for a specific service
docker compose logs -f backend

# Reset everything (wipes database + storage)
docker compose down -v
docker compose up --build

# Run backend tests (when added)
docker compose exec backend pytest

# TypeScript type check
cd frontend && npx tsc --noEmit

# Production build
cd frontend && npm run build
```

---

## Troubleshooting

**Port conflicts:** If ports 3000, 5432, 6379, 8000, 9000, or 9001 are in use, stop the conflicting service or change the port mapping in `docker-compose.yml`.

**Database migration errors:** If the database gets into a bad state, reset with:
```bash
docker compose down -v
docker compose up --build
```

**MinIO bucket not created:** The `minio-init` service creates the bucket on startup. If it fails, create it manually via the MinIO console at [localhost:9001](http://localhost:9001).

**Backend hot-reload not working:** The `backend/app` directory is mounted as a volume. Changes to files inside `app/` should trigger uvicorn reload automatically. Changes to `requirements.txt` or files outside `app/` require `docker compose up --build`.
