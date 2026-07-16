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
- **`ModelingObjective: 'Virtual Wind Tunnel'` is the key that unlocks the FT
  workflow for external aero** (probe 6372294): with it set,
  `Describe Geometry and Flow`.Execute() returns True on the bare wing. 2025R1
  ships a purpose-built VWT objective — exactly the AutoAnsys use case; probe10
  (6372329) chains it toward a full pipeline-built wing mesh.
- `%py-exec` mechanics: the Scheme reader converts `\n` escapes to REAL newlines
  before Python compiles — multi-line Python source works directly, but a `\n`
  inside a Python string literal splits it ("unterminated string literal",
  probe 6372085). Guard helpers must be defined as direct multi-line defs.
- A failed task `Execute()` raises `S_ExecuteTask` and can abort the journal →
  idle-at-prompt hang (see finding 2). Production journals should keep task
  sequences pre-validated; probes wrap risky calls in try/except.

## Test articles (assessment CORRECTED by probe 6375236)

| File | Contents | Pipeline path |
|---|---|---|
| `geometries/RW_1.5_Geom.x_t` | **TWO bodies: `enclosure` + `geom`** (wing). No face labels/attributes, but the enclosure box IS in the file — Fluent objects after import: `['enclosure', 'geom']`. The earlier "bare part" read (grep for labels) missed the unnamed-body enclosure. | FT/VWT + CEFB **"Use existing boundary"** on `enclosure` |
| `geometries/V0.1_STEP.stp` | 12-product / 40-solid full-car assembly **including a `Bounding Box` body** (Kevin's April 2026 enclosure export) — no face labels | Same "Use existing boundary" pattern; boundary typing via VWT/Update Boundaries (validating) |

## The proven VWT chain (probes 6372187 → 6376546)

Working batch sequence on the real wing (first pipeline-built mesh:
`wing_probe18.cas.h5`, job 6375946):

1. `InitializeWorkflow('Fault-tolerant Meshing')`
2. `PartManagement.InputFileChanged(FilePath=…, IgnoreSolidNames=False, PartPerBody=False)`
3. `PMFileManagement.FileManager.LoadFiles()`  *(no args)*
4. `Import CAD and Part Management`.Execute()
5. DGF `set_state({'ModelingObjective': 'Virtual Wind Tunnel'})` → Execute
6. CEFB `set_state({'CreationMethod': 'Use existing boundary', 'SelectionType': 'object', 'ObjectSelectionSingle': ['enclosure'], 'ExtractionMethod': 'surface mesh'})` → Execute
7. Update Region Settings → Choose Mesh Control Options → Generate the Surface
   Mesh → (Compute Regions → Update Boundaries) → Generate Boundary Layers →
   Generate the Volume Mesh → switch → write-case

**Authoritative schema source:** `cortex/resources/Meshing.fdl` (copied to local
scratchpad) + the bundled PyFluent stubs
(`…/site-packages/ansys/fluent/core/generated/datamodel_251/*.py`). CEFB's real
`CreationMethod` enums are **"Create new boundary" / "Use existing boundary"**
(my 'Bounding Box' guess = the opaque "invalid argument" errors). Default
tunnel name: `"tunnel"`. `IdentifyRegions.MptMethodType` enums:
"Numerical Inputs" / "Centroid of Objects" / "Offset Method".

Open at probe20: probes 18/19 meshed only the wing **solid** (region table =
`['geom']/solid`; no fluid region) — 12,785 cells, and the unlabeled wing faces
arrive as per-face `zone0:NNN` wall zones. Probe20 adds `Identify Regions`
(fluid material point at the enclosure centroid) to extract the tunnel fluid.

## ✅ COMPONENT PATH ACCEPTANCE — PASSED (job 6388127, 2026-07-16)

Pure production artifacts (JournalGenerator journal + slurm template run.sh,
zero hand edits) ran end-to-end on ARC: **Fluent exit 0 → JOB_COMPLETE** in
1 m 48 s. Produced: converged `forces.csv` (drag 63.98 N, downforce 163.63 N —
bit-identical across runs), `setup.cas.h5`, `result.cas.h5` + `result.dat.h5`,
and all four contour PNGs. The wing component pipeline is validated:
geometry file → mesh (2 m) → named boundaries → solve (2 m) → forces →
coefficients → pictures, no manual steps.

Solver-journal 2025R1 TUI facts (probes 6380260–6388066), all in templates:
- pressure-outlet: `gauge-pressure` (not `pgauge`).
- `/solve/set/p-v-coupling` takes numeric enums (24=Coupled); discretization
  schemes take numeric indices (pressure 12, upwind 1) — names abort.
- moment report def: `mom-center … mom-axis …` (not moment-vector).
- `report-files/add … report-type iteration` invalid → residuals from transcript.
- `/solve/convergence-conditions/add …` invalid — correct syntax undiscovered;
  iterate-N is the stop, plateau judged in post.
- Same-name write-case then write-case-data → overwrite prompt desyncs the
  journal (data file silently lost) → distinct `setup.cas.h5`/`result.cas.h5`.
- Re-running a case whose report-files already exist → append y/n prompt →
  fresh unique workspaces matter (the pipeline already guarantees this).
- **Pictures need `-gu -driver null`** — under `-g` the graphics subsystem is
  absent and `display save-picture` does not exist.
- TUI menu state persists across journal lines; leading `/` resolves RELATIVE
  after entering a menu → all display commands go via
  `(ti-menu-load-string "…")` (stateless, root-anchored).
- Contours are display objects: `display objects create contour <n> field <f>
  surfaces-list <s> () quit` → `display objects display <n>` →
  `display save-picture "<file>"`. Iso-surface arg order
  `surface iso-surface z-coordinate midplane-z () () 0 ()` validated.

Full-car recon (fc1, job 6388074): the V0.1 STEP imports clean with NAMED
per-component objects — `bounding_box`, `wheels.1–4`, `chassis.1–6`,
`cfd-wing-front.1/2`, `undertray`, `suspension*` — so the car reuses the wing
recipe with name-based wheel BCs and per-component merges. *Superseded:*
maintainer go-ahead came with a specialist-validated V0.4 geometry and
watertight journal — see "Full-car path" section below.

## Sizing + resources for the FT/VWT mesh (probes 6377252–6378056)

- **Sizing API**: `Choose Mesh Control Options` (`ReadOrCreate: 'Create new'`,
  `CreationMethod: 'Custom'`, `GlobalMin/GlobalMax/GlobalGrowthRate`) + scoped
  controls via **`Add Local Sizing` (AddLocalSizingFTM) children** with
  `LocalSizeControlParameters: {SizingType: curvature|proximity|soft|boi,
  MinSize, MaxSize, GrowthRate, CurvatureNormalAngle (default 18), CellsPerGap}`
  — then **`Compute Size Field(s)`** (`ComputeSizeFieldControl: 'yes'`) writes
  the `.sf` files the wrap requires. Executing `Size Controls Table` directly
  rejects (it wants pre-existing entries); ALS is the intended API.
- Without CSF, `Generate the Surface Mesh` fails with
  `ftm-wf-out-<file>-target.sf not found`.
- Default (bbox-derived) sizing wraps but produces sliver faces on the thin
  wing → "Mesh topology corrupted (v-m-v-w)" (probe 6377117).
- **Memory**: the 2 mm size-field wrap OOM-killed a 64 GB allocation
  (`oom_kill` in probe 6377338); FTM wrap needs full-node memory even at modest
  rank counts → meshing jobs should request ~243 GB.
- The size-field build runs many minutes with **no stdout** (Fluent buffers when
  redirected) — a silent log is not a hang; budget the wrap ≥1–2 h at 2 mm.
- **Anti-zombie guard** (probe22+): run fluent in background, poll the log for
  "An error or interrupt occurred while reading the journal", kill on match —
  turns 40-min idle burns into ~10 s failures. Adopted for the production
  sbatch template.

## Automated boundary assignment (probes 6380058–6380198) — SOLVED

`wing_probe33.cas.h5` is a **named, typed, solver-ready case** (222,745 cells):
`inlet` (velocity-inlet), `outlet` (pressure-outlet), `ground`, `farfield-1..3`,
and all 19 wing patches merged into one `wing` wall. Mechanism (all in-run,
zero manual steps):

1. `meshing_utilities.get_face_zones(filter='zone0*')` → **int zone IDs**.
2. Per-zone areas via `get_face_zone_area(face_zone_id_list=[id])` (kwarg name
   matters; returns a single float total) → 6 largest = box faces.
3. `get_bounding_box_of_zone_list(zone_id_list=[id])` → 6-float extents (mm) →
   thin-axis classification; x-faces → inlet/outlet chosen by wing proximity
   (SOP box is short in front / long behind); **z=0 floor exists → `ground`**
   (z is up in the team's exports); remaining → farfield.
4. Python writes the rename/merge/type commands as a **Scheme file** of
   `(ti-menu-load-string "...")` lines; after `switch-to-solution-mode`,
   `(load "...")` executes them. (`/file/read-journal` inline args do NOT parse
   — it prompts for a list and swallows the next journal line; probe 6380144.)
5. `modify-zones/zone-name <id> <name>` and `merge-zones <ids> ()` accept
   numeric zone IDs directly — no name lookup needed.

This resolves **F3 with evidence**: the body wall pattern for force reports is
the merged `wing` zone (assembly meshes should merge per-component for
per-component force breakdowns later).

More %py-exec ground rules learned:
- `meshing_utilities.get_objects(filter='*')` (documented form) works; bare
  `get_objects()` raises and **any datamodel exception aborts the journal even
  when caught in Python** — no optional queries before the main attempt.
- `meshing_utilities` has `get_bounding_box_of_zone_list` /
  `get_average_bounding_box_center` for coordinate queries if needed.

## Template corrections driven by this evidence

- `_contours_block.jou.j2`: iso-surface via TUI (finding 3).
- All marker prints → Scheme `(display …)` (finding 3/5-adjacent; solver-mode safe).
- `mesh_fault_tolerant.jou.j2`: **pending rewrite** against the real task list —
  wrong FlowType (`Internal` → external), wrong import sequence, missing
  `Create External Flow Boundaries`. Tracked in task "Cluster validation —
  component path".

## ✅ ACCEPTANCE-2 — half-model corrected (job 6388594, 2026-07-16)

The wing geometry is a HALF rear wing cut at y=0 (domain extents
y ∈ [−1.5013, +0.00007], probes 6389014/6388594). Acceptance re-ran with the
symmetry BC on the y≈0 face and `force_factor: 2.0`:
**Fluent exit 0 → JOB_COMPLETE in 1 m 34 s**, all artifacts written.
Official full-wing numbers at 15 m/s (×2, production parser):
**downforce 327.6 N, drag 128.1 N**, moment −0.66 N·m; Cd 1.96 / Cl −5.00
(ref. area 0.475 m²). Convergence plateau: last-50-iteration σ = 0.002 N
(drag) / 0.007 N (lift). The profile's `half_model: true, force_factor: 2.0`
defaults were correct all along.

## Contour views — sideways slice imagery (probes 6388814/6389014 + job 6388594)

The y=0 mid-span slice renders full flow-field content on the production
watertight mesh (job 6388594 PNGs). Getting a face-on ("sideways") view needs
a strict command order because of two headless-graphics gotchas:

1. **The graphics window is created lazily by the first `display`.** Any
   `views …` command issued before it silently no-ops (returns `#t`, changes
   nothing) — probe 6389014's first-command `restore-view bottom` left the
   default view; probe 6388814's same command after a display applied.
2. **A view/camera change does not redraw the scene.** Saving without a
   re-display captures an empty canvas (probes 6388621/6388683).

Validated per-image sequence (now in `_contours_block.jou.j2`):
`display objects display <obj>` (bootstrap window) → `views camera
target/position/up-vector …` → `display objects display <obj>` (redraw) →
`views auto-scale` (frames content, keeps direction) → `display save-picture`.
Slice images use camera on −y looking along +y with up (0,0,1) (x right,
z up — true side elevation); the body-cp image resets an isometric camera
because window state persists between images.

Named views are untrustworthy here: `restore-view front/back/right` are
edge-on for a y-normal slice, and `top` never applied even mid-session.
Explicit `views camera` + `auto-scale` is deterministic and geometry-agnostic.

## Full-car path — V0.4-stepFC + specialist watertight journal (2026-07-16)

Maintainer delivered `geometries/V0.4-stepFC` (STEP, extension stripped —
uploaded to ARC as `.stp`) validated by a CFD specialist, plus the
specialist's GUI-recorded meshing journal (`meshjournal.jou`). Analysis:

- **Watertight workflow, fluid-only CAD**: `Describe Geometry` declares
  "only fluid regions with no voids" + `WallToInternal: Yes` — the STEP
  models the tunnel-minus-car fluid volume directly. No enclosure/wrap step.
- **Half car**: prism labels list only left wheels (`front-left-wheel`,
  `rear-left-wheel`) → symmetry plane + force ×2, like the wing.
- Units mm. Named face labels: chassis, front/rear-wing, whisker,
  trailing-edges, undertray, suspension, wheels.
- New workflow pieces to codify: `CreateLocalRefinementRegions` (tire-wake
  boxes ratio-relative to wheel labels + absolute nearfield box), face
  sizings with CellsPerGap/CurvatureNormalAngle (TE at 0.25 mm!), boundary
  layers `last-ratio` ×6 grown on selected labels only, `poly-hexcore` fill
  with `HexMaxCellLength: 32`.
- **Batch fixes required** (GUI recording): no workflow init, no import
  FileName (was set in a GUI dialog), `cx-gui-do` transcript/Switch-to-
  Solution calls → replaced with `InitializeWorkflow`, explicit
  `Arguments.set_state({FileName, LengthUnit})`, and TUI
  `switch-to-solution-mode yes`.
- The recorded `set_state` calls are **deltas** (GUI records only changed
  fields; task-argument state persists between `AddChildAndUpdate` calls) —
  replay must keep the exact order.

fc3 (job 6391613) replays the adapted journal end-to-end and writes
`fc_v04_mesh.cas.h5` + zone list for solver BC wiring.
