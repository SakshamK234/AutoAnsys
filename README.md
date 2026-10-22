# AutoAnsys

Upload a CAD file, get aerodynamic results. AutoAnsys generates ANSYS Fluent
journals, submits them to a SLURM cluster over SSH, and pulls back forces,
coefficients, residuals and contour images. It was built for the Virginia Tech
FSAE aero team so that running CFD does not require knowing Fluent's TUI or
babysitting a login node.

Two run profiles share one pipeline: a single component (wing, endplate,
undertray) and a half-car full assembly. A profile carries the domain and
symmetry treatment, boundary conditions, reference values, mesh settings and
cluster resources, so submitting a job is a matter of picking one and uploading
geometry.

## Running it

```bash
make up   # builds + starts everything → http://localhost:3000
```

First run only: `make up` creates `.env` from `.env.example` if missing — edit it
to point at your cluster (never copy over an existing `.env`; it holds your
settings). `make down` stops the stack; `make logs`, `make test`, `make dryrun`
are also available.

The UI is at http://localhost:3000 and the API at http://localhost:8000.

`CLUSTER_MOCK_MODE=true` by default, which fakes the cluster so you can work on
the UI without an account or a VPN. Mock jobs complete on a timer and return
placeholder results.

To render every journal and SLURM script for both profiles without Docker or a
cluster:

```bash
cd backend && python -m app.journal.validate --out ./_dryrun
```

That is the fastest way to see what actually gets sent to Fluent.

## Connecting to a real cluster

You need an account on a SLURM cluster with Fluent installed, and network
access to it (VPN if you are off campus).

1. In `.env`, set `CLUSTER_MOCK_MODE=false` and fill in `CLUSTER_HOST`,
   `CLUSTER_USER`, `CLUSTER_ACCOUNT`, `CLUSTER_WORKSPACE_BASE` and
   `FLUENT_MODULE`. `CLUSTER_KEY_PATH` is the path to the key *inside* the
   container.
2. Set `CLUSTER_SSH_KEY_HOST_PATH` to the key's path on your machine, and
   uncomment the SSH key volume mounts for `backend` and `celery-worker` in
   `docker-compose.yml`.
3. Restart the backend and worker containers, then check the connection:

```bash
docker compose exec backend python -c "
from app.cluster.ssh_manager import SSHManager
s = SSHManager(); s.connect()
print(s.execute_command('hostname')[0])"
```

Key authentication has to work without a passphrase prompt. Test `ssh` from the
host first.

## How a job runs

Pick a profile, upload a geometry, and submit. The backend renders a Fluent
journal and a SLURM batch script, uploads both to scratch along with the
geometry, and runs `sbatch`. A Celery beat task polls `sacct` and updates job
state; when the job finishes, results are downloaded into object storage and
parsed.

Forces are integrated over the body wall zones only, never over every wall, and
half-car runs are doubled in post-processing rather than in the journal.

Meshing and solving can be split: one mesh can feed many solves, which is what
parametric sweeps use.

## Repository layout

```
backend/
  app/journal/templates/   Jinja templates for Fluent journals and SLURM scripts
  app/profiles/            run profiles (the single source of truth for defaults)
  app/cluster/             SSH, SFTP and SLURM managers
  app/post/                force and residual parsing, coefficient maths
  app/tasks/               Celery submit, poll and download tasks
  tests/                   81 tests, no Fluent or cluster required
frontend/                  React UI
docs/                      architecture, config reference, runbook, findings
```

Run the tests with `cd backend && python -m pytest`. They render journals and
check the output against golden files, so template changes show up as readable
diffs.

## Documentation

- [Getting started](docs/GETTING_STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Config reference](docs/CONFIG_REFERENCE.md)
- [Runbook](docs/RUNBOOK.md) for submitting, monitoring and troubleshooting
- [Cluster findings](docs/CLUSTER_FINDINGS.md), every Fluent 2025R1 quirk we hit
  and the job ID that proved it. Read this one before touching the journal
  templates.
- [Validation](docs/VALIDATION.md)

## Configuration and secrets

The committed `.env.example` and `docker-compose.yml` use placeholder
credentials (`your_netid`, `minioadmin`, `dev-secret-change-in-production`).
Replace all of them before exposing this anywhere beyond localhost, and do not
commit a real `.env` or a private key.

Fluent is not included. You need your own license and a cluster module that
provides it.

### Production checklist (v2 hardening)

Set in `.env` before exposing the app beyond your laptop (the backend refuses
to boot in `ENVIRONMENT=production` with placeholder secrets):

- `ENVIRONMENT=production`, `JWT_SECRET=$(openssl rand -hex 32)`
- `CORS_ORIGINS=http://<host>:3000`, `S3_PUBLIC_ENDPOINT=http://<host>:9000`,
  `MINIO_BIND=0.0.0.0` (LAN presigned downloads), non-default MinIO credentials
- `INVITE_CODE=<team code>` — closes registration and disables guest login
- `MAX_ACTIVE_JOBS_PER_USER` / `MAX_UPLOAD_MB` to taste

The SLURM account is pinned server-side from `CLUSTER_ACCOUNT`; guests are
read-only; every config string that reaches a journal or SBATCH line is
validated at the API boundary. See [docs/CHANGES_V2.md](docs/CHANGES_V2.md).

## License

MIT License