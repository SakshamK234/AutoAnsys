# AutoAnsys — one-command interface to the whole stack.
#
#   make up      → build + start everything, then open http://localhost:3000
#   make down    → stop everything
#
# Requires: Docker Desktop running, and .env configured (see .env.example;
# CLUSTER_SSH_KEY_HOST_PATH must point at your ARC key for real runs).

COMPOSE := docker compose
GIT_SHA := $(shell git rev-parse HEAD 2>/dev/null || echo unknown)

.PHONY: up down restart logs ps test build dryrun clean help

# Create .env from the example ONLY when missing — never overwrite a
# configured one (a stray `cp .env.example .env` loses cluster settings).
.env:
	cp .env.example .env
	@echo "Created .env from .env.example — edit it to point at your cluster"
	@echo "(CLUSTER_HOST/USER, CLUSTER_SSH_KEY_HOST_PATH, CLUSTER_MOCK_MODE=false)."

## Start the full stack (frontend http://localhost:3000, API :8000, MinIO :9000)
up: .env
	GIT_SHA=$(GIT_SHA) $(COMPOSE) up --build -d
	@echo ""
	@echo "AutoAnsys is up →  http://localhost:3000"

## Stop the stack (data volumes are kept)
down:
	$(COMPOSE) down

## Restart after code changes that aren't bind-mounted (index.html, public/, deps)
restart:
	GIT_SHA=$(GIT_SHA) $(COMPOSE) up --build -d backend celery-worker celery-beat frontend

## Tail all service logs
logs:
	$(COMPOSE) logs -f --tail 100

## Show service status
ps:
	$(COMPOSE) ps

## Run the backend test suite inside the container (full env, DB included)
test:
	$(COMPOSE) run --rm backend pytest -q

## Type-check + production-build the frontend
build:
	cd frontend && npm run build

## Render every Fluent journal/SLURM artifact offline for inspection
dryrun:
	$(COMPOSE) run --rm backend python -m app.journal.validate --out /tmp/dryrun

## Stop AND delete data volumes (database, uploaded files) — destructive
clean:
	$(COMPOSE) down -v

help:
	@grep -B1 -E "^[a-z]+:" Makefile | grep -E "^##|^[a-z]+:" | sed 's/^## //; s/:.*//' | paste - - | awk '{printf "  make %-10s %s\n", $$NF, substr($$0, 1, length($$0)-length($$NF)-1)}' 2>/dev/null || true
