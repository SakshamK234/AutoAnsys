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
