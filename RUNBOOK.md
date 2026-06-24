# RUNBOOK.md — Operating AutoAnsys jobs on SLURM (ARC TinkerCliffs)

How to submit, monitor, and retrieve CFD jobs, plus a troubleshooting guide.
AutoAnsys automates all of this through the web app + Celery; the commands below
are what it runs (and what you run by hand to debug).

---

## Job lifecycle (what AutoAnsys does)

1. **Create** a job/mesh in the wizard → stored as `draft` with a resolved config.
2. **Submit** → status `queued`; a Celery worker downloads the geometry, renders
   the Fluent journal + `run.sh`, SFTPs them to a per-run **scratch** workspace
   `/scratch/<user>/autoansys/jobs/<id>/`, writes `run_metadata.json`, and runs
   `sbatch run.sh`.
3. **Poll** → Celery beat polls `sacct` every 30 s and maps SLURM state to
   `queued/running/completed/failed/cancelled`.
4. **Retrieve** → on `COMPLETED`, results (forces/residuals/contours/case/metadata)
   are SFTP'd back and pushed to S3; the UI shows forces, coefficients, residuals,
   and contour images.

Split workflow: a **Mesh** job produces `mesh.cas.h5` (reusable); one or many
**Solve** jobs consume it. Sweeps over solver-only params reuse the same mesh.

---

## Manual SLURM commands

```bash
# Submit (AutoAnsys does this for you)
sbatch /scratch/$USER/autoansys/jobs/<id>/run.sh        # -> "Submitted batch job 12345"

# Watch the queue
squeue --me
squeue -j 12345

# Status / accounting (what the poller reads)
sacct -j 12345 --format=JobID,State,Start,End,Elapsed,ExitCode --noheader --parsable2

# Live solver output
tail -f /scratch/$USER/autoansys/jobs/<id>/fluent.log
tail -f /scratch/$USER/autoansys/jobs/<id>/slurm-12345.out

# Cancel
scancel 12345

# What ran (reproducibility)
cat /scratch/$USER/autoansys/jobs/<id>/run_metadata.json
```

The generated `run.sh` derives the rank count from `$SLURM_NTASKS`, builds a
hostfile from `scontrol show hostnames "$SLURM_JOB_NODELIST"`, and launches
`fluent 3ddp [-meshing] -g -t$NCORES -mpi=intel -pib -cnf=$HOSTFILE -i autoansys.jou`.
A non-zero Fluent exit propagates (`exit $FLUENT_EXIT`) so SLURM marks the job
`FAILED` and the poller sees it.

---

## Per-profile resources (defaults)

| | nodes | cores/node | mem | walltime | mesh workflow |
|---|---|---|---|---|---|
| `individual_part` | 1 | 128 | 243 G | 6 h | Watertight |
| `full_car` | 2 | 128 | 243 G | 24 h | Fault-tolerant |

Meshing jobs are additionally capped to 16 cores / 1 node (Watertight meshing is
largely single-threaded). Override any value in the wizard's Resources step.

---

## Troubleshooting

### License / HPC-Pack queueing
- Symptom: job runs but Fluent stalls at startup, `fluent.log` mentions licensing.
- Licensing comes from `module load ANSYS/2025R1`. If the module doesn't export
  servers, set `ANSYSLMD_LICENSE_FILE=<port@host>` / `ANSYSLI_SERVERS` (there's a
  commented hook in `run.sh`). HPC-Pack governs how many cores you may run in
  parallel — if you exceed your entitlement the job waits for licenses; reduce
  `cores_per_node` or acquire more HPC-Pack tokens.

### Meshing fails on a dirty full-car STEP
- Watertight meshing rejects gaps / non-watertight bodies. Use the **full_car**
  profile, which selects the **fault-tolerant (surface-wrapped)** workflow.
- That FT journal is currently an **unvalidated skeleton** (see VALIDATION.md):
  run it interactively first, fix the capping zone names and the fluid material
  point, then submit through the pipeline.

### Multi-node job runs slow / uses one node
- Confirm `fluent.log` lists hosts on **all** allocated nodes. If everything is on
  one node, the hostfile or `-cnf` is wrong — check
  `scontrol show hostnames "$SLURM_JOB_NODELIST"` output in `run.sh`'s log and that
  `-cnf=$HOSTFILE` is present. Confirm `-mpi=intel -pib` matches your site's fabric.

### Convergence stalls
- Judge convergence on the **force plateau**, not residuals alone. If `drag_force`
  is still drifting at the iteration cap, raise `convergence.max_iterations` or
  improve mesh quality / prism layers. If Fluent rejected the
  `/solve/convergence-conditions` line (2025R1 TUI), the run only stops at the cap
  — fix the TUI form (VALIDATION.md §4).

### Forces look ~2× too small or too large (symmetry)
- Half-car runs are doubled via `symmetry.force_factor` (2.0 by default). If you
  ran a **full** (non-symmetric) geometry, set `half_model=false`,
  `force_factor=1.0`, and remove the symmetry-plane BC. The config guard logs a
  warning when a symmetry plane is present without the factor (or vice-versa).
- Coefficients also depend on `reference_values.area_m2` being the **full** frontal
  area (F1) and `density_kg_m3` being correct.

### `/forces` endpoint returns empty for a real run
- The parser is tolerant of Fluent's whitespace/quoted report-file format, but the
  exact header is unconfirmed (AUDIT S7). Pull the real `forces.csv` and compare
  to `tests/test_report_files.py` fixtures; adjust the parser if the header differs.

### `run.sh: bad interpreter` / `\r` errors on Linux
- A CRLF line-ending crept into a template. `.gitattributes` forces LF on
  `*.sh/*.j2/*.jou/*.yaml`; re-clone or run `git add --renormalize .` if an old
  checkout introduced CRLF.

### Job stuck in `queued`
- Normal — SLURM hasn't allocated yet. `squeue --me` shows position. Busy
  partitions (or large `--nodes`) wait longer.
