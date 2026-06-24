# AutoAnsys documentation

Start with the [project README](../README.md) for an overview and quick start.

### Getting started
- [Getting Started](GETTING_STARTED.md) — run the stack (Docker / local dev), structure, API endpoints
- [Submitting Jobs](SUBMITTING_JOBS.md) — batch vs OOD session, the SLURM script, partitions

### Operating
- [Runbook](RUNBOOK.md) — submit / monitor / retrieve a job (`sbatch`/`squeue`/`sacct`/`scancel`) + troubleshooting
- [Validation](VALIDATION.md) — the human-in-the-loop checks that must run on the real ARC cluster

### Reference
- [Architecture](ARCHITECTURE.md) — stage diagram, module map, run-profile design, correctness invariants
- [Config Reference](CONFIG_REFERENCE.md) — every mesh / solver / SLURM / env parameter, for both profiles

### Project history (the audit & rework)
- [Audit](AUDIT.md) — read-only diagnosis of the original pipeline (evidence per defect)
- [Plan](PLAN.md) — repair-vs-rework decision + milestone plan
- [Changes](CHANGES.md) — what was broken → what changed, what's tested, what still needs the cluster
- [Mesh/Solver Split Plan](MESH_SOLVER_SPLIT_PLAN.md) · [SOP Alignment Plan](SOP_ALIGNMENT_PLAN.md) · [Upgrades roadmap](UPGRADES.md)
