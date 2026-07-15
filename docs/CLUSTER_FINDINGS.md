# Cluster findings — live validation evidence (ARC TinkerCliffs)

Running log of **facts established by real jobs on ARC** (vs. assumptions), with
the job IDs that produced them. Raw outputs live in
`/scratch/sakshamkumar/autoansys/diagnostic/` on the cluster.

## Environment (recon, 2026-07-15)

| Fact | Value | Source |
|---|---|---|
| Module | `ANSYS/2025R1` (site default is 2025R2 — pin explicitly) | `module avail` |
| Fluent binary | `/apps/common/software/ansys/2025R1/v251/fluent/bin/fluent` | `module show` + probe |
| License | install-tree `ansyslmd.ini` → `1055@ansys.software.vt.edu`; checkout from compute nodes confirmed | probe 6371613 banner |
| SLURM | 25.11.3; account `fsae` valid | `sacctmgr` |
| `normal_q` nodes | 288× AMD 128c/252GB (bulk) + 16× Intel 96c + 8× 128c/1TB himem | `sinfo -e` |
| Scratch | `/scratch/sakshamkumar` on 1.4PB filesystem | `ls`/`df` |

## Fluent 2025R1 batch behaviour

| # | Finding | Evidence |
|---|---|---|
| 1 | Both `fluent 3ddp -meshing` and `fluent -meshing 3ddp` launch fine; `%py-exec` + workflow API alive in batch | probe 6371613 T1/T2 |
| 2 | **Journal errors do NOT exit Fluent** — it idles at the prompt until walltime/timeout kills it. Wrap every `fluent` call in `timeout`; SLURM walltime is the backstop | probe T3 (exit 124), probe3 (same) |
| 3 | **No `solver`/`setup`/`tui` Python globals in solution mode** (post-switch or pure launch). The original template's `solver.results.surfaces.iso_surface[...]` always raised NameError → midplane contours were silently broken. Fixed to TUI `/surface/iso-surface` | March diagnostic `solver-4917231.out`; probe T4 |
| 4 | Solver-mode TUI top menu includes `surface/`, `define/`, `report/`, `solve/` (+ `/define/boundary-conditions/set/` exists) | probe T4 |
| 5 | Meshing-mode TUI has **no `/workflow` menu** — workflow only via `%py-exec` | probe T3 |

## Watertight workflow (2025R1) — probe 6371692 on the real wing

- Import of the bare `RW_1.5_Geom.x_t` (Parasolid, no labels/enclosure) **succeeds**.
- Task list: Import Geometry, Add Local Sizing, Generate the Surface Mesh,
  Describe Geometry, **Apply Share Topology**, **Enclose Fluid Regions (Capping)**,
  Update Boundaries, **Create Regions**, Update Regions, Add Boundary Layers,
  Generate the Volume Mesh.
- Insertable tasks (GetNextPossibleTasks): `AddBoundaryType`, `UpdateBoundaries`,
  `ImproveSurfaceMesh`, `ManageZones`, `RunCustomJournal`, …
- **No enclosure-creation task exists in Watertight** — capping closes openings
  only. → A bare part **cannot** get a pipeline-built external domain via
  Watertight; route through Fault-tolerant.

## Fault-tolerant workflow (2025R1) — probes 6371722 / 6371861 on the wing

- Real task list (**differs from the blind-written template**): Import CAD and
  Part Management, Describe Geometry and Flow, Create Local Refinement Regions,
  **Create External Flow Boundaries**, Enclose Fluid Regions (Capping),
  Add Thickness, Extract Edge Features, Identify Construction Surfaces,
  Create Porous Regions, Identify Regions, Define Leakage Threshold,
  Update Region Settings, Choose Mesh Control Options, Size Controls Table,
  Add Local Sizing, Generate the Surface Mesh, Compute Size Field(s),
  Close Leakage, Remesh Surface, Compute Regions, Update Boundaries,
  Add Boundary Layers, Generate the Volume Mesh, Generate Boundary Layers,
  Generate Volume Meshing.
- **`Create External Flow Boundaries` is the external-aero domain builder** —
  this is the pipeline's `build_enclosure` implementation target.
- Import is **not** a plain FileName arg: `PMFileManagement.FileManager.LoadFiles`
  takes **no arguments** (kwargs crash: "S_LoadFiles: CAR: invalid argument");
  files must first be registered via `PartManagement.InputFileChanged(FilePath=…,
  IgnoreSolidNames=…, PartPerBody=…)`.
- Import sequence facts (probes 6371861/6371893/6371919/6372085):
  - `InputFileChanged → LoadFiles()` auto-populates the Import task args
    (`FMDFileName`, `Route: 'Parasolid'`) and converts the CAD to an `.fmd`.
  - The loaded file appears in `PMFileManagement` as `File:File-1`
    (`Name: 'RW_1.5_Geom.x_t'`, `Keys: [2]`) — PyFluent-style copy paths use the
    `"/name,key"` suffix form.
  - `Node['Meshing Model'].Copy(Paths=[…])` with a wrong path **silently
    no-ops** (no exception, no node added).
  - `Import…Execute()` "succeeds" even with nothing copied in; the failure only
    surfaces later when `Describe Geometry and Flow`.Execute rejects.
  - `FlowType: 'External flow around the object'` is the **verbatim accepted
    enum** for external aero (probe 6371893).
- `%py-exec` mechanics: the Scheme reader converts `\n` escapes to REAL newlines
  before Python compiles — multi-line Python source works directly, but a `\n`
  inside a Python string literal splits it ("unterminated string literal",
  probe 6372085). Guard helpers must be defined as direct multi-line defs.
- A failed task `Execute()` raises `S_ExecuteTask` and can abort the journal →
  idle-at-prompt hang (see finding 2). Production journals should keep task
  sequences pre-validated; probes wrap risky calls in try/except.

## Test articles

| File | Contents | Pipeline path |
|---|---|---|
| `geometries/RW_1.5_Geom.x_t` | Bare wing solid — no labels, no enclosure, no Parasolid attributes | FT + Create External Flow Boundaries (pipeline builds domain) |
| `geometries/V0.1_STEP.stp` | 12-product / 40-solid full-car assembly **including a `Bounding Box` body** (Kevin's April 2026 enclosure export) — but **no face labels** | FT; boundary types must be assigned geometrically or via re-export with labels (open question for aero lead) |

## Template corrections driven by this evidence

- `_contours_block.jou.j2`: iso-surface via TUI (finding 3).
- All marker prints → Scheme `(display …)` (finding 3/5-adjacent; solver-mode safe).
- `mesh_fault_tolerant.jou.j2`: **pending rewrite** against the real task list —
  wrong FlowType (`Internal` → external), wrong import sequence, missing
  `Create External Flow Boundaries`. Tracked in task "Cluster validation —
  component path".
