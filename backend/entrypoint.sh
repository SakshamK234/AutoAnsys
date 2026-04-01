#!/bin/bash
set -e

if [ $# -eq 0 ]; then
    echo "Running database migrations..."
    alembic upgrade head

    echo "Starting server..."
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
    exec "$@"
fi
