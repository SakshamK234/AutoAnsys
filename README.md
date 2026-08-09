# AutoAnsys

Upload a CAD file, get aerodynamic results. AutoAnsys generates ANSYS Fluent
journals, submits them to a SLURM cluster over SSH, and pulls back forces,
coefficients, residuals and contour images. It was built for the Virginia Tech
FSAE aero team so that running CFD does not require knowing Fluent's TUI or
babysitting a login node.

Two run profiles share one pipeline: a single component (wing, endplate,
undertray) and a half-car full assembly.

## Status

The full-car path works end to end on VT ARC. A geometry goes in, a 6-million
cell mesh comes out, the solve converges, and forces land in the UI. That part
is real and has been run many times.

Accuracy is the open problem. A CFD specialist on the team supplied a solved
case for the same car, meshed at 41.9 million cells. Under identical boundary
conditions our mesh over-predicts:

| | Cells | Drag | Downforce |
|---|---|---|---|
| Specialist reference | 41.9 M | 311 N | 832 N |
| AutoAnsys | 6.07 M | 417 N | 1461 N |

Same geometry, same freestream (17.88 m/s), same moving ground and rotating
wheels. The difference is mesh resolution. Use the current output for
comparing design variants, not for absolute numbers.

Other things worth knowing before you rely on this:

- The component path fails on raw geometry that has no face labels. The mesh
  builds, but merging the wrapped surface zones does not work yet, so the
  boundary conditions have nothing to attach to.
- The geometry still has to arrive with a wind tunnel enclosure already built
  around it (SpaceClaim or Discovery). Building the enclosure automatically is
  the main thing v2 is meant to fix.
- Camera control for contour images does not work under Fluent's headless
  graphics driver. Images render in the default view only.

A rewrite is planned rather than more patching. [prompt.md](prompt.md) is the
brief for it, and carries the Fluent knowledge this version was built on.

## Running it

```bash
cp .env.example .env
docker compose up --build
```

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
half-car runs are doubled in post-processing rather than in the journal. Both
of those were bugs in an earlier version, which is why they are called out here.

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
- [Validation](docs/VALIDATION.md) for what has and has not been verified on
  real hardware

## Configuration and secrets

The committed `.env.example` and `docker-compose.yml` use placeholder
credentials (`your_netid`, `minioadmin`, `dev-secret-change-in-production`).
Replace all of them before exposing this anywhere beyond localhost, and do not
commit a real `.env` or a private key.

Fluent is not included. You need your own license and a cluster module that
provides it.

## License

See [LICENSE](LICENSE). ANSYS and Fluent are trademarks of ANSYS, Inc., and
using them is subject to your own license agreement.
