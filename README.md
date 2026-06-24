# AutoAnsys

Web app for configuring **ANSYS Fluent** CFD workflows, submitting jobs to an **HPC cluster** (SLURM + SSH), and tracking results.

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- **Frontend:** http://localhost:3000  
- **API:** http://localhost:8000  
- **Docs:** [GETTING_STARTED.md](./GETTING_STARTED.md), [docs/SUBMITTING_JOBS.md](./docs/SUBMITTING_JOBS.md)

By default, **`CLUSTER_MOCK_MODE=true`** so the stack runs without a real cluster (mock jobs complete for UI development). To submit to your site’s HPC, set `CLUSTER_MOCK_MODE=false` and configure cluster variables in `.env` (see below).

## Running a CFD job

A job is driven by one **run profile** (`cfd_mode`), which selects domain/symmetry,
ground/wheel BCs, mesh strategy, reference values, and SLURM sizing — one pipeline,
two scopes:

- **Component** (`individual_part`) — a single part/sub-assembly. Watertight mesh,
  1 node / 6 h, symmetry plane + ×2 force factor.
- **Full car** (`full_car`) — the whole assembly, run half-car. Fault-tolerant
  (surface-wrapped) mesh, 2 nodes / 24 h, moving ground + rotating wheels +
  symmetry + ×2.

End to end: upload a geometry (Parasolid recommended) → **New Job** wizard → pick the
profile, adjust mesh/solver/resources → **Submit**. AutoAnsys renders the Fluent
journal + SLURM script, runs it in scratch, and returns forces (N), coefficients
(Cd/Cl/Cm), residuals, and contour images. The split workflow lets one **mesh** feed
many **solves** (sweeps reuse the mesh).

**Preview without a cluster** — render every artifact for both profiles offline:

```bash
cd backend && python -m app.journal.validate --out ./_dryrun
```

### Docs
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stage diagram, module map, run-profile design
- [docs/CONFIG_REFERENCE.md](docs/CONFIG_REFERENCE.md) — every config parameter + both profiles
- [RUNBOOK.md](RUNBOOK.md) — submit / monitor / retrieve + troubleshooting
- [VALIDATION.md](VALIDATION.md) — what must be validated on the real cluster
- [AUDIT.md](AUDIT.md) · [PLAN.md](PLAN.md) · [CHANGES.md](CHANGES.md) — the audit, plan, and change summary

## Configuration (public / production)

- **Never commit** a real `.env` or SSH private keys. The repository uses **placeholders** such as `your_netid`, `your_slurm_account`, and `cluster-login.example.edu`.
- **Rotate** `JWT_SECRET`, database passwords, and S3 keys for any deployment that is reachable beyond your laptop.
- **Docker Compose** ships with **development-only** secrets (`minioadmin`, `dev-secret-change-in-production`, etc.). Do not use those values in production.
- **ANSYS Fluent** is not redistributed here; you need a valid license and module layout on your cluster.

### Connecting Docker services to a real cluster

1. Set in `.env`: `CLUSTER_MOCK_MODE=false`, `CLUSTER_HOST`, `CLUSTER_USER`, `CLUSTER_WORKSPACE_BASE`, `CLUSTER_ACCOUNT`, `FLUENT_MODULE`, and `CLUSTER_KEY_PATH` (path **inside** the container).
2. Uncomment the SSH key volume lines in `docker-compose.yml` for **backend** and **celery-worker**, and set `CLUSTER_SSH_KEY_HOST_PATH` in `.env` to your **host** path to the private key (see `.env.example`).

## License

Application code in this repository is provided under the terms of the [LICENSE](./LICENSE) file if present; otherwise clarify with the repository owner. **ANSYS** and **Fluent** are trademarks of ANSYS, Inc.; use of those products is subject to your license agreement with ANSYS.
