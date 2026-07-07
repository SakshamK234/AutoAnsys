# Configuration reference

Every job stores a config `{cfd_mode, mesh, solver, slurm}`. Per-profile presets
live in `backend/app/profiles/profiles.yaml` and are applied by
`apply_cfd_mode_defaults` / `apply_cfd_mode_slurm_defaults` /
`apply_cfd_mode_mesh_defaults` (non-clobbering — they only fill values left at the
schema default). Schema: `backend/app/schemas/job.py`.

## Run profile

| Field | Values | Notes |
|---|---|---|
| `cfd_mode` | `individual_part` \| `full_car` | The run profile. Drives BCs, symmetry, mesh workflow, reference area, iterations, SLURM. |

## Mesh (`MeshConfig`)

| Field | Default | Notes |
|---|---|---|
| `workflow` | `watertight` | `watertight` (clean parts) or `fault-tolerant` (dirty full-car wrap). Profile-driven. |
| `build_enclosure` | `false` | If true, build the enclosure from the part bbox instead of assuming a pre-built one (bare-part input). [needs-cluster] |
| `surface_mesh.min_size` / `max_size` | 2.0 / 264.0 | mm (in `geometry_unit`). |
| `surface_mesh.curvature_normal_angle` | 18.0 | |
| `surface_mesh.growth_rate` | 1.2 | |
| `volume_mesh.num_layers` | 15 | Prism layer count — now wired into Add Boundary Layers (was ignored). |
| `volume_mesh.first_layer_height_mm` | `null` | Opt-in absolute first prism height (mm) for wall-resolved **y+ ≈ 1** (F9); ~0.02–0.05 mm at 15.65 m/s. `null` keeps the proven SOP last-ratio defaults. [needs-cluster] verify `FirstHeight` with last-ratio on 2025R1. |
| `volume_mesh.first_layer_height` | 5e-5 | **Deprecated** — never reached Fluent; kept only so stored configs validate. |
| `volume_mesh.bl_growth_rate` | 1.2 | |
| `mesh_quality.surface_skewness_threshold` | 0.6 | Auto-improve surface mesh if exceeded. |
| `mesh_quality.volume_orthogonal_quality_threshold` | 0.15 | Auto-improve volume mesh if exceeded. |
| `mesh_quality.auto_improve` | true | |
| `geometry_unit` | `mm` | |
| `original_zones` | inlet/outlet/ground/symmetry/walls | Face labels preserved through meshing. |
| `enclosure.*` | SOP mm values | Documentation/auditing of a Discovery-built enclosure. |
| `local_sizing[]` | [] | Body-of-influence / face sizings (aero/chassis/wheels/intake/nearfield/farfield/rear_wing). |

## Solver (`SolverConfig`)

| Field | Default | Notes |
|---|---|---|
| `turbulence.model` | `k-omega-sst` | Also `k-epsilon-realizable`, `spalart-allmaras`. |
| `turbulence.curvature_correction` | true | k-ω SST curvature correction. |
| `reference_values.area_m2` | 1.2 (full_car → 0.65, **F1 placeholder**) | **Full** frontal area for a half-model. |
| `reference_values.length_m` | 2.8 | Moment reference length. |
| `reference_values.velocity_mps` | 15.65 | Freestream. |
| `reference_values.density_kg_m3` | 1.225 | Sea-level air. [needs-cluster] |
| `symmetry.half_model` | false (profiles → true) | Half-domain run. |
| `symmetry.force_factor` | 1.0 (profiles → 2.0) | Multiplies reported forces **and** coefficients (AUDIT C1). |
| `reporting.body_wall_pattern` | `wall-body*` | Force integration scope (not all walls). **F3.** |
| `reporting.emit_forces_newtons` / `emit_coefficients` | true / true | Report both (decision #2). |
| `reporting.moment_center_{x,y,z}` | 0 | Moment reference point. |
| `convergence.max_iterations` | 300 (full_car → 750) | Hard upper bound. |
| `convergence.residual_target` | 1e-4 | Residual criteria. |
| `convergence.force_monitor_window` / `force_monitor_tolerance` | 100 / 0.001 | Force-plateau convergence window/tolerance. |
| `convergence.use_force_convergence` | true | Emit `/solve/convergence-conditions` for the drag report. [needs-cluster] |
| `solution_methods.*` | Coupled / second-order | p-v coupling, gradient, discretization. |
| `initialization` | `hybrid` | Or `hybrid-absolute`. |
| `boundary_conditions.*` | per profile | Typed lists: velocity_inlets, pressure_outlets, translating_walls, rotating_walls, slip_walls, stationary_walls, symmetry_planes. Empty lists are skipped (graceful degradation). |

## SLURM (`SlurmConfig`)

| Field | Default | Notes |
|---|---|---|
| `nodes` | 1 (full_car → 2) | Per-profile. |
| `cores_per_node` | 128 | TinkerCliffs node size. Meshing is capped to 16. |
| `memory_gb` | 243 | |
| `walltime_hours` | 24 (individual_part → 6) | Whole hours. |
| `partition` | `normal_q` | |
| `account` | `your_slurm_account` (set to `fsae`) | Site SLURM allocation. |
| `job_name` | `autoansys_cfd` | |
| `mpi` | `intel` | Fluent `-mpi=`. |
| `interconnect` | `infiniband` | → `-pib` (`ethernet` → `-peth`). |

## Environment (`Settings`, from `.env`)

`DATABASE_URL`, `REDIS_URL`, `S3_*`, `JWT_SECRET`, `CLUSTER_HOST/USER/KEY_PATH/WORKSPACE_BASE/ACCOUNT`,
`CLUSTER_MOCK_MODE`, `FLUENT_MODULE` (`ANSYS/2025R1`), `GIT_SHA` (recorded per run),
`JOB_POLL_INTERVAL`. See `.env.example`.
