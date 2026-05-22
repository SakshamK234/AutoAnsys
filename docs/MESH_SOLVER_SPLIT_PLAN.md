# Mesh / Solver Split — Design & Migration Plan

## Why

Today one `Job` runs `meshing → switch-to-solution-mode → solve` in a single
Fluent session. This has been painful:

- Every debugging iteration costs ~7 min of surface meshing + ~2 min volume
  meshing, even when we only changed a BC or turbulence flag.
- Parametric sweeps over solver-only parameters (e.g. inlet velocity 15/20/25/30)
  re-mesh the identical geometry N times.
- A crash in Phase 2 discards the Phase 1 mesh; no checkpointing.
- SLURM sizing is awkward: meshing likes ~16-32 cores, solver wants 128.

## Target architecture

Two first-class artifacts, each with its own SLURM job:

```
Geometry (uploaded Parasolid/STEP)
   │
   ├──► Mesh (produces mesh.cas.h5)
   │       │  config hash of (geometry_id, mesh_config)
   │       │  reusable — one Mesh → many Solves
   │       ▼
   └──► Solve (consumes mesh.cas.h5, produces forces.csv + contours)
           many Solves can reference the same Mesh
```

## Data model

### New table: `meshes`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK users | |
| `geometry_id` | uuid FK geometries | |
| `group_id` | uuid FK groups, nullable | |
| `name` | str | human label; auto-generated if unset |
| `status` | enum (draft/queued/running/completed/failed/cancelled) | |
| `config` | jsonb | mirrors `MeshConfig` + `SlurmConfig` + `cfd_mode` |
| `config_hash` | str(64) indexed | sha256 of (geometry_id, normalized mesh_config); used for reuse lookup |
| `cell_count` | int, nullable | populated on success |
| `meshing_minutes` | float, nullable | wall-clock for the Fluent Phase 1 |
| `slurm_job_id` | str, nullable | |
| `submitted_at` / `started_at` / `completed_at` | timestamptz, nullable | |
| `cluster_workspace` | str, nullable | |
| `case_file_s3_key` | str, nullable | where `mesh.cas.h5` lives after success |
| `created_at` | timestamptz | |

### Change: `jobs` table

- `jobs.mesh_id` — new uuid FK meshes, nullable (NULL = legacy combined-mode job).
- `jobs.geometry_id` — kept for backwards compat; new jobs get it from mesh.
- `jobs.config` still stores `solver` + `slurm` + `cfd_mode`; `mesh` key becomes
  optional (only set for legacy combined jobs).

Migration `005_add_meshes.py` creates the table + FK + index on `config_hash`.

## Journal templates

Split `mesh_watertight.jou.j2` into three:

1. **`mesh_only.jou.j2`** — Phase 1 (Watertight workflow) → `switch-to-solution-mode`
   → `/file/write-case "{{ workspace }}/mesh.cas.h5"` → `/exit yes`.
2. **`solver_from_case.jou.j2`** — `/file/read-case "{{ workspace }}/mesh.cas.h5"`
   → Phase 2 (BCs, models, reference values) → Phase 3 (monitors, init, iterate)
   → Phase 4 (contour PNGs) → `/exit yes`.
3. **`mesh_watertight.jou.j2`** — kept as-is for legacy combined-mode jobs so
   existing Job records still work.

`JournalGenerator` gets two new methods: `generate_mesh_journal(mesh_config, geom_file, workspace, cfd_mode)` and `generate_solver_journal(solver_config, case_file, workspace, cfd_mode)`.

## Celery task pipeline

### Meshing

- `submit_mesh_to_cluster(mesh_id)` — mirrors `submit_job_to_cluster` but:
  - downloads geometry from S3 → SFTP upload,
  - renders `mesh_only.jou.j2` + `slurm_mesh.sh.j2` (smaller resource default:
    1 node, 32 cores, 64 GB, 4 h walltime),
  - `sbatch run.sh`, stores SLURM id on mesh.
- `poll_active_meshes` — new periodic Celery Beat task (parallel to
  `poll_active_jobs`); same SLURM state map; on completion triggers
  `download_mesh_artifact(mesh_id)`.
- `download_mesh_artifact(mesh_id)` — SFTP download `mesh.cas.h5`,
  `meshing.log`, any mesh-quality report PNGs; upload to S3; populate
  `case_file_s3_key`, `cell_count`, `meshing_minutes`.

### Solving

- `submit_job_to_cluster(job_id)` — **modified**. If `job.mesh_id` is set:
  - verify mesh is in `completed` state; if not, raise and mark job failed,
  - SFTP-copy the mesh `case_file_s3_key` to the solver's workspace
    (download from S3 to backend, then SFTP up — or have SLURM curl from a
    presigned URL; simpler to do via backend for now),
  - render `solver_from_case.jou.j2` + `slurm_solve.sh.j2`,
  - sbatch as before.
- Legacy (null `mesh_id`) jobs keep rendering the combined journal.

### Mesh reuse

Before creating a new Mesh, `MeshService.get_or_create()`:

1. Compute `config_hash = sha256(geometry_id.bytes + canonical_json(mesh_config_normalized))`.
   Normalization drops zero-significant fields and sorts dict keys.
2. Query `meshes WHERE config_hash = ? AND status='completed'` ordered by `created_at desc`.
3. If found, return the existing Mesh. Otherwise create a new draft.

Sweeps over solver-only params hit step 2 on every point after the first.

## API surface

New routes in `backend/app/api/meshes.py`:

```
POST   /api/meshes                 → MeshCreate (geometry_id, name, cfd_mode, mesh_config, slurm_config)
GET    /api/meshes                 → list (paginated, filter: status, geometry_id, group_id, search)
GET    /api/meshes/{id}            → detail
GET    /api/meshes/{id}/status     → status-only (polling)
POST   /api/meshes/{id}/submit     → queue + submit_mesh_to_cluster.delay
POST   /api/meshes/{id}/sync       → manual SLURM sync
POST   /api/meshes/{id}/cancel     → scancel
GET    /api/meshes/{id}/download   → presigned URL for mesh.cas.h5
DELETE /api/meshes/{id}            → delete (cascade: forbid if jobs reference it)
```

Job routes extend:
- `POST /api/jobs` now accepts `mesh_id` *or* `mesh_config` (not both). If
  `mesh_config` is given, we do a `get_or_create(mesh)` and attach its id.
- `GET /api/jobs/{id}` response includes a nested `mesh` summary if set.

## Frontend

### New pages

- `frontend/src/pages/meshes.tsx` — list, analogous to `jobs.tsx`. Columns:
  name, geometry, cell count, status, created, meshing time.
- `frontend/src/pages/mesh-detail.tsx` — mesh detail. Tabs: config, log,
  "jobs using this mesh" (link back).
- Sidebar entry "Meshes" added between "Geometries" and "Jobs".

### Wizard changes

Top of wizard gets a **mode selector**:

- **Mesh + Solve (default)** — current flow, creates a Mesh on the fly then a Job.
- **Mesh only** — Geometry → Mesh config → Resources → Review. Submits only the
  mesh; no Solver step.
- **Solve from existing mesh** — *Select Mesh* (replaces Geometry step) →
  Solver config → Resources → Review. Submits only the Job with `mesh_id`.

Geometry step hidden when mode = "Solve from existing mesh"; replaced by a
searchable Mesh picker (filters to `status=completed` meshes owned by user or
user's groups).

### Job detail

Top of the page shows a "Mesh" badge linking to the mesh detail page, with
cell count + meshing time.

### Sweeps

Sweep page gets the same mode selector. A sweep over solver-only params
against a selected Mesh creates N solver jobs all referencing the same mesh;
the first time a sweep is over mesh params (e.g. `surface_mesh.max_size`),
each point creates a separate Mesh.

## Migration strategy

1. Ship model + migration + empty API layer (no frontend yet). Legacy combined
   jobs keep working because `jobs.mesh_id` is nullable.
2. Ship mesh-only journal template and Celery tasks. Manually submit via API
   to validate Phase 1 ends with a readable case file on ARC.
3. Ship solver-from-case template and Celery rewire behind a feature flag
   (`USE_SPLIT_WORKFLOW=true`).
4. Ship frontend pages + wizard mode selector.
5. Flip default. Leave combined mode as a fallback for one release, then delete.

## Out of scope (follow-ups)

- Automatic promotion of legacy combined jobs to Mesh + Job pairs.
- Cross-user mesh sharing (currently scoped to owner + owner's groups).
- Mesh visualization preview (cell count + quality summary only for now).
- Large file streaming: mesh files can be >1 GB — current design downloads to
  the backend container then re-uploads via SFTP. If this becomes a bottleneck,
  switch to direct `s3 cp` on the compute node via IAM instance profile or
  presigned URL.

## File touchpoint list

### Backend — new
- `backend/app/models/mesh.py`
- `backend/app/schemas/mesh.py`
- `backend/app/services/mesh_service.py`
- `backend/app/api/meshes.py`
- `backend/app/tasks/mesh_tasks.py`
- `backend/app/journal/templates/mesh_only.jou.j2`
- `backend/app/journal/templates/solver_from_case.jou.j2`
- `backend/app/journal/templates/slurm_mesh.sh.j2` (optional — or reuse `slurm_job.sh.j2` with a mode flag)
- `backend/alembic/versions/005_add_meshes.py`

### Backend — modified
- `backend/app/models/__init__.py` (export Mesh)
- `backend/app/models/job.py` (add `mesh_id` FK, relationship)
- `backend/app/schemas/job.py` (JobCreate accepts `mesh_id`; JobResponse nests mesh summary)
- `backend/app/journal/generator.py` (add `generate_mesh_journal`, `generate_solver_journal`)
- `backend/app/services/job_service.py` (on create: resolve mesh_id or get_or_create)
- `backend/app/tasks/job_tasks.py` (branch on `mesh_id`: fetch case file instead of geometry)
- `backend/app/tasks/celery_app.py` (register mesh_tasks + beat schedule)
- `backend/app/api/__init__.py` (register meshes router)

### Frontend — new
- `frontend/src/pages/meshes.tsx`
- `frontend/src/pages/mesh-detail.tsx`
- `frontend/src/components/wizard/mesh-picker-step.tsx`
- `frontend/src/components/wizard/job-mode-selector.tsx`

### Frontend — modified
- `frontend/src/types/index.ts` (add `Mesh`, `MeshStatus`)
- `frontend/src/lib/api.ts` (add mesh helpers if we move away from inline calls)
- `frontend/src/App.tsx` (routes)
- `frontend/src/components/layout/sidebar.tsx` (nav entry)
- `frontend/src/components/wizard/job-wizard.tsx` (conditional step ordering)
- `frontend/src/components/wizard/geometry-step.tsx` (unchanged, but hidden in mesh-from-existing mode)
- `frontend/src/pages/job-detail.tsx` (show mesh badge)
- `frontend/src/pages/sweep.tsx` (sweep mode selector)
