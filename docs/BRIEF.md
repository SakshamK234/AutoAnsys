# AutoAnsys — Engineering Brief (v2 rebuild)

*This is the "rewritten prompt": what an expert CFD-automation developer would set out
to build, given the original ask and everything learned from the v1 attempt.*

## The ask, restated

Build a production-ready web platform where an FSAE aerodynamics engineer can:

1. **Submit a part** exported from CAD (NX → Parasolid `.x_t` preferred; STEP/IGES accepted).
2. Have it **meshed and solved automatically** in ANSYS Fluent on Virginia Tech ARC
   (TinkerCliffs, SLURM), with team-standard defaults from the CFD SOPs
   (15.65 m/s freestream, k-ω SST + curvature correction, part enclosure in mm,
   hybrid-absolute init), while still allowing expert overrides.
3. **Review results with the team**: convergence (residuals), force coefficients
   (Cd/Cl/Cm computed *as coefficients on the part only*), contour images, downloadable
   case/data files, run comparison, and group-shared visibility.

## What v1 taught us (and what v2 must do differently)

| v1 failure | v2 decision |
|---|---|
| Generated Fluent **TUI/scheme journals** guessed zone names (`body-1`, `inlet-1`…) → "Invalid Zone name" crashes on real geometry | Drive Fluent with **PyFluent** (`ansys-fluent-core`) running on the compute node. Query actual zone names/bounding boxes at runtime; classify tunnel faces geometrically; no guessed names ever written into code. |
| Journal `%py-exec` one-liners were write-only, undebuggable, version-fragile | One versioned, tested **`fluent_runner.py`** uploaded with each job. Errors are Python tracebacks in `runner.log`. Config travels as **`job.json`** (data, not code) — this also kills the string-injection surface of Jinja-rendered journals. |
| SLURM `COMPLETED` ≠ solve succeeded; failed jobs left no logs in the app | Runner writes `manifest.json` with explicit per-phase status + error message; the app downloads logs **always**, including on failure, and surfaces the error in the UI. |
| "cd/cl/cm" were raw forces (N) summed over *every* zone incl. tunnel walls | True **coefficient report definitions** (drag/lift/moment-coefficient) scoped to the part's wall zones, with SOP reference values; moment center configurable. |
| `residuals.csv` never produced; backend parsers expected a CSV format Fluent never writes | Runner itself writes clean `forces.csv` / `residuals.csv` in the exact schema the API parses; parsers also accept Fluent `.out` format defensively. |
| Boundary-layer parameters silently ignored by the meshing template | Full watertight-workflow parameter pass-through (BL first height / layers / growth, local sizings, quality auto-improve thresholds) via the PyFluent meshing API. |
| Login-node policy violation risk; OOD "session mode" documented but never implemented | Batch `sbatch` on compute nodes is the only execution path. Login node does file staging + `sbatch`/`sacct` only. (OOD overlap mode is out of scope until batch is rock-solid.) |
| Security: unescaped strings into SLURM scripts/journals, open guest submits, `AutoAddPolicy`, no upload limits | Validate every field that reaches a script (regex-constrained job name/partition/account), role-gate submission, upload size caps, pinned/accept-new host keys, no secrets in repo. |

## Architecture (unchanged where it worked)

```
React SPA ── FastAPI ── Postgres (metadata) / MinIO (files) ── Celery+Redis
                                                  │
                                       SSH/SFTP (paramiko, key auth)
                                                  │
                              ARC login node: stage files, sbatch, sacct
                                                  │
                              Compute node (SLURM job): module load ANSYS/2025R2
                              → shared PyFluent venv → fluent_runner.py job.json
                              → mesh.cas.h5 / result.cas.h5 / forces.csv /
                                residuals.csv / contours/*.png / manifest.json
```

- **Mesh / Solve split** stays: a Mesh (geometry + mesh config, content-hashed for
  reuse) is a first-class artifact; many Solves can reference one Mesh. Combined
  mode = runner does both phases in one allocation.
- **Provisioning**: backend ensures `~/autoansys/pyfluent-venv` exists on ARC
  (python312 module + `ansys-fluent-core`), creating it on first use.
- **Progress**: runner appends structured NDJSON events (phase changes, residuals,
  coefficients) to `progress.ndjson`; the Celery poller tails it over SFTP and
  publishes to Redis → WebSocket → live charts.

## Definition of done

1. A Parasolid part uploaded through the UI meshes and solves on TinkerCliffs
   compute nodes with zero manual SSH, producing coefficients, residual history,
   and contour images in the job page. **Proven by an acceptance run on ARC.**
2. Failures are diagnosable from the UI alone (phase, error message, logs).
3. The team can review: groups, comparison view, live monitoring all functional.
4. No known injection paths from user input to shell/Fluent; submission is
   role-gated; secrets configurable and absent from the repo.
