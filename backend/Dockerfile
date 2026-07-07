FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# App git SHA recorded in each run's run_metadata.json (reproducibility).
# Passed by docker-compose as GIT_SHA=$(git rev-parse HEAD); defaults to "unknown".
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}

RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
