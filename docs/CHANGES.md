# Change summary — CFD pipeline audit & rework

Branch `audit/cfd-pipeline-review`. Full diagnosis in [AUDIT.md](AUDIT.md); plan in
[PLAN.md](PLAN.md). Approach: **hybrid** — repair the (sound) orchestration/SLURM
plumbing, rework the CFD-correctness and meshing layers, and elevate `cfd_mode`
into a real run profile.

## What was broken → what changed

| # | Was broken (audit) | Fix | Repair/Rework |
|---|---|---|---|
| C1/C9 | Half-car forces never doubled; full_car had no symmetry plane | Symmetry plane added to full_car; `symmetry.force_factor` ×2 applied to forces **and** coefficients in `app/post/forces.py` | Rework |
| C2 | "Cd/Cl/Cm" were raw forces, not coefficients | Journal emits honest body **forces** (N); Cd/Cl/Cm **derived** from forces + reference values; both reported | Rework |
| C3 | Forces summed over **all** walls (`thread-names *`) | Scoped to `reporting.body_wall_pattern` | Repair |
| C4 | Reference **density** never set | `/report/reference-values/density` emitted; `density_kg_m3` config | Repair |
| C5 | Convergence on residuals only | Force-plateau `/solve/convergence-conditions` wired from existing knobs | Repair |
| C6 | Prism/`num_layers` config ignored | `NumberOfLayers` wired into Add Boundary Layers | Repair |
| C7 | Combined journal rendered empty contour surfaces | Shared `_contours_block` defines zone vars for both journals | Repair |
| C10/C11 | No enclosure build; Watertight-only | `mesh.workflow` (watertight/fault-tolerant) + `build_enclosure`, profile-driven; FT template added | Rework |
| S1 | Multi-node Fluent launch missing hostfile/MPI/IB | Hostfile from `scontrol`; `-mpi=intel -pib -cnf` | Repair |
| S6 | `sync` mis-parsed "CANCELLED by <uid>" | Split state verb in both services | Repair |
| S7 | Parsers assumed mock CSV format | Tolerant whitespace/quoted report-file parser | Rework |
| E2 | Dead templates `solver_setup/solver_run` | Removed | Cleanup |
| E3 | CRLF could corrupt generated `run.sh` | `.gitattributes` LF for `*.j2/*.jou/*.yaml` | Repair |
| E5 | No reproducibility metadata | `run_metadata.json` per run (config, profile, Fluent module, git SHA, time) | New |
| E6 | `sanitize_path` allowed `../` traversal | Reduced to safe basename | Repair |
| — | `cfd_mode` was BC-preset-only | Single `profiles.yaml` source of truth driving BCs, symmetry, mesh workflow, reference area, iterations, SLURM | Rework |

## What is tested (Fluent-free, passing)

`78 passed, 4 skipped` locally (the 4 skipped need pydantic/pytest-asyncio → run in
Docker): run-profile resolution, journal + SLURM generation (golden + invariants
for both profiles), force/coefficient math incl. symmetry doubling, tolerant
report-file parsing, sanitization, run-metadata, and a schema↔fixtures cross-check.
A `--validate` dry-run renders every artifact for both profiles without Fluent.

## Outstanding — human validation on the cluster (see VALIDATION.md)

- **Fault-tolerant meshing journal** (`mesh_fault_tolerant.jou.j2`) is an
  unvalidated skeleton — **#1 item**.
- Real Fluent report-file header + residual-capture mechanism (S7).
- `/solve/convergence-conditions` TUI on 2025R1 (C5).
- Prism **first-layer height / y+** control (C6 partial).
- Full-car **reference area (F1)**, **body wall pattern (F3)**, air **density**.
- Confirm multi-node MPI spans nodes and HPC-Pack licensing (S1/S2).

## Maintainer decisions (2026-07-07)

| Item | Decision | Effect |
|---|---|---|
| F1 full-car ref area | Keep `0.65` placeholder | Still flagged; replace with measured full frontal area before trusting full-car Cd/Cl |
| F3 body wall pattern | Keep `wall-body*` guess | Confirm against a real mesh zone list |
| F9 y+ target | Wall-resolved y+ ≈ 1 | `volume_mesh.first_layer_height_mm` (opt-in) emits `FirstHeight`; unset keeps proven SOP prism defaults |
| F4 full-car outlet | **Fix** | `pressure_outlets: outlet` added to the full_car preset (yaml + fixtures + frontend mirror) |
| Air density | Keep 1.225 kg/m³ | — |
| E1 OOD session mode | **Removed** | Dead `_sync_session_job` + docs Method 2 deleted; legacy `session:` ids are skipped with a warning |
| Wizard → `/api/profiles` | Deferred | Mirror is synced; live rewiring awaits a verifiable frontend session |

## Completed follow-ups (post-M7)

- **Per-profile defaults endpoint:** `GET /api/profiles` + `GET /api/profiles/{mode}`
  serve the resolved presets from `profiles.yaml`, so the frontend can stop
  hand-mirroring them. *(Docker-only verification — needs the full app stack.)*
- **Frontend mirror re-synced:** the wizard's `applyCfdModeDefaults` full_car
  preset was stale vs M2 — it lacked the centreline **symmetry plane**, so a
  wizard-created full-car job would have carried the ×2 force factor without the
  plane (the exact inconsistency the correctness guard warns about). Fixed; TS
  types now include `symmetry`/`reporting`/`density_kg_m3`/`use_force_convergence`/
  `mpi`/`interconnect`/`workflow` and the force-N fields on `ForceReport`.
  *(Type-check `npx tsc --noEmit` must run in Docker/CI — Node is not available
  in the environment used for this work.)*
- **GIT_SHA wiring:** `backend/Dockerfile` (ARG/ENV) + `docker-compose.yml`
  (build arg + runtime env for backend/worker) + `.env.example`, so
  `run_metadata.json` records a real SHA instead of "unknown".

## Deferred (noted, not done)

- **E1** OOD "session" mode references a non-existent module — left unreachable/
  harmless; keep-or-remove is a product decision.
- **E7** structured logging / request-id tracing.
- Frontend consumption of `GET /api/profiles` (the endpoint exists; the wizard
  still uses its local mirror — wiring it up needs a runnable frontend to verify).
