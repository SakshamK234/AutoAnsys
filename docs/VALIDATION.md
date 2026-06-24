# VALIDATION.md — Human-in-the-loop cluster validation

This is the runbook for validating AutoAnsys **on the real ARC TinkerCliffs
cluster with a real Fluent license**. Everything here requires hardware and
software the development environment does not have.

> **What was NOT run by the implementer.** No part of the CFD pipeline was
> executed against Fluent or submitted to SLURM during development. Fluent could
> not run locally (no license, no `pydantic-core` wheel for the local Python).
> All journals and SLURM scripts below were **generated and inspected**, and the
> non-Fluent logic (config/profile resolution, journal/SLURM generation, force &
> coefficient math, report-file parsing, sanitization, run-metadata) is
> **unit-tested and passing**. The items in this file are exactly the things that
> only a human on the cluster can confirm. Do not treat them as verified until
> you have run them.

Legend: ☐ = to do · each item says what "pass" looks like.

---

## 0. Pre-flight (no Fluent needed)

☐ **Generate every artifact offline and read it.**
```bash
cd backend
python -m app.journal.validate --out ./_dryrun
# inspect both profiles:
ls _dryrun/individual_part _dryrun/full_car
```
Pass: `combined.jou`, `mesh_only.jou`, `solver_from_case.jou`, `run_meshing.sh`,
`run_solver.sh` exist for both profiles and read sensibly.

☐ **Run the Fluent-free test suite** (needs the full Python env / Docker, which
has `pydantic`):
```bash
cd backend && pytest -q
```
Pass: all pass (locally without pydantic it is `78 passed, 4 skipped`; in Docker
the 4 skipped `pytest-asyncio` + schema cross-check tests also run).

---

## 1. Component case (individual_part) — end to end

☐ Upload a clean single-part geometry (Parasolid recommended), create a job with
`cfd_mode=individual_part`, submit.

☐ **Watertight meshing completes** and writes `mesh.cas.h5`. Check `fluent.log`
for the cell count between the `MESH_CELL_COUNT_BEGIN/END` markers.

☐ **Solver runs and forces.csv is produced** with columns `drag_force`,
`lift_force`, `mom_y` (Newtons). Confirm the AutoAnsys `/forces` endpoint returns
non-empty data (this exercises the real-format parser, AUDIT S7).

☐ **Force scope:** confirm the reports integrate over the body wall zone(s) only.
The body wall pattern defaults to `wall-body*` — **edit `reporting.body_wall_pattern`
to match your actual body zone names (F3)** if the integral looks wrong (e.g.
includes the ground/tunnel).

☐ **Physical sanity (component):** Cd/Cl magnitudes and **signs** are reasonable
for the part; downforce is negative lift (per the convention here). Numbers are
in `app.post.forces` units: forces in N, coefficients dimensionless.

---

## 2. Full-car case (full_car) — end to end  ⚠️ highest-risk

☐ **Fault-tolerant meshing is UNVALIDATED.** `mesh_fault_tolerant.jou.j2` is a
documented skeleton, **not** a proven flow. Run it interactively in Fluent
Meshing first and fix the per-task `set_state` args, the **capping zone mapping**,
and the **fluid material point** (currently a placeholder `(0,0,0)` — set it
inside the fluid domain). Only then submit via the pipeline. **This is the #1
validation item.**

☐ Half-car domain meshes with the centreline **symmetry plane** present.

☐ Moving **ground** at freestream and **rotating wheels** (front/rear) are
applied — confirm in the zone list / BC echo.

☐ **Multi-node MPI actually spans nodes.** The script builds a hostfile from
`scontrol show hostnames "$SLURM_JOB_NODELIST"` and launches
`fluent ... -mpi=intel -pib -cnf=$HOSTFILE`. Inspect `fluent.log` for the host
list and confirm ranks land on **both** nodes (not all on one). This is the core
AUDIT S1 fix and cannot be verified off-cluster.

☐ **Licensing:** the run acquires Fluent + HPC-Pack licenses via
`module load ANSYS/2025R1`. If it stalls on licensing at the target core count,
set `ANSYSLMD_LICENSE_FILE` in the script (there is a commented hook).

---

## 3. The symmetry factor — verify the classic bug is actually fixed

☐ **Confirm half-car forces are doubled.** The pipeline reports
`force × symmetry.force_factor` (2.0 for both default profiles, since both run a
half-domain). Hand-check: take Fluent's raw half-model `drag_force` from the
solver transcript and confirm the AutoAnsys `/forces` value ≈ **2×** it. Same for
lift and the derived Cd/Cl.

☐ **Confirm the reference area is the FULL frontal area (F1).** With half-model
forces doubled, `reference_values.area_m2` must be the **full** car frontal area
(the shipped `0.65` is a flagged placeholder). Set the true value; Cd/Cl scale
inversely with it.

☐ If you ever run a **non-symmetric** geometry, set `symmetry.half_model=false`,
`symmetry.force_factor=1.0`, and remove the symmetry-plane BC — the correctness
guard warns if these are inconsistent.

---

## 4. Convergence & mesh independence

☐ **Force-coefficient plateau:** confirm `drag_force` flattens before the
iteration cap, not just that residuals dropped. The journal emits
`/solve/convergence-conditions/add ... report-def drag_force ...` —
**[needs-cluster] verify this TUI line is accepted on 2025R1**; if Fluent rejects
it, the run still stops at `max_iterations` (the hard cap), so you lose early-stop
but not correctness. Adjust the TUI form if needed and re-run the golden test.

☐ **Mesh independence:** run coarse/medium/fine (vary `surface_mesh.max_size`
and/or `volume_mesh.num_layers`) and confirm Cd/Cl change by less than your
tolerance between medium and fine. The sweep feature can drive this.

---

## 5. Things flagged in code as [needs-cluster]

Search the repo for `needs-cluster` to find every item built to documented
2025R1 behaviour but not executed:
- Fault-tolerant meshing journal (`mesh_fault_tolerant.jou.j2`) — task args,
  capping, material point.
- `/solve/convergence-conditions` TUI arg order.
- Prism **first-layer height / y+** control (only `NumberOfLayers` is wired; the
  absolute first-cell height needs a different offset method — set the y+ target).
- Real Fluent **report-file header** format and the **residual-capture mechanism**
  (`report-type iteration` may not emit residual values — transcript parsing of
  `fluent.log` may be required).
- Air **density** / operating conditions.
- Exact **module string**, MPI, interconnect, and **HPC-Pack** licensing
  (confirmed by the maintainer as Intel MPI + InfiniBand + module-provided
  license, but not executed).

Please feed back a real `forces.csv`, `residuals` output, and a `fluent.log` from
one successful run so the parsers and the FT journal can be tightened against
ground truth.
