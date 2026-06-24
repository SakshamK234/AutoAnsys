# Cluster diagnostics

One-off scripts for probing Fluent/SLURM behaviour on ARC TinkerCliffs — **not**
part of the application. Copy to a scratch diagnostic dir and submit/run on the
cluster (edit the `your_netid` / account placeholders first).

| File | Purpose |
|---|---|
| `launch.sh` | SBATCH probe: which `fluent` binary, `-meshing` flag ordering, exec discovery |
| `meshing.jou` | Tries each Fluent Meshing workflow-init method (2025R1 API discovery) |
| `solver.jou` | Discovers the solver-mode Python API after `switch-to-solution-mode` |
| `run.sh` | Convenience wrapper to submit the probe |

These informed the working journal templates in `app/journal/templates/`.
