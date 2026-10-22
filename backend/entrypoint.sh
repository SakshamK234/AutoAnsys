#!/bin/bash
set -e

if [ $# -eq 0 ]; then
    echo "Running database migrations..."
    alembic upgrade head

    echo "Starting server (ENVIRONMENT=${ENVIRONMENT:-development})..."
    if [ "${ENVIRONMENT:-development}" = "production" ]; then
        exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers "${UVICORN_WORKERS:-2}"
    else
        exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    fi
else
    exec "$@"
fi
