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

fc3 (job 6391613) replayed the adapted journal — import succeeded (49 s to
first error, fail-fast guard worked) but the refinement region aborted:
**the specialist's short labels do not exist in this STEP export.** Fluent's
error helpfully enumerated the real labels — assembly-path names like
`vtm_27e-wheels-front-left-wheel`, `vtm_27e-front-wing`,
`vtm_27e-rear-wing-instance-63`, `vtm_27e-chassis-27_ch_monocoque_v.5-_cfd-
instance-7`, plus `v0.4-step-enclosure` (the fluid volume) and
`bounding-box-instance-44`. Findings:

- The file (HOOPS Exchange 24.6.0 re-export of the specialist's
  `V0.4-step.stp`) carries NO face-level named selections at all — grep of
  the ASCII STEP finds no inlet/outlet/symmetry/ground/trailing-edges
  anywhere. The specialist's source file must have had them; this copy lost
  them, so his exact journal cannot replay 1:1 on this file.
- `trailing-edges` (his 0.25 mm face sizing + prism label) has NO
  counterpart → dropped in fc4; TE mesh quality relies on curvature/
  proximity sizing until a labelled export is provided.
- BOTH right wheels exist as labels (car assembly is complete); the
  specialist's prism/sizing lists cover left wheels only, consistent with a
  half-car fluid volume that excludes the right side.
- The import brings the whole tree: fluid `Enclosure`, all car solids, and
  a `Bounding Box` body (41 MANIFOLD_SOLID_BREPs) — the fluid-only Describe
  declaration is the specialist's own; whether Update Regions handles the
  extra solids gracefully is answered by fc4.

fc4 (job 6393124) = fc3 with label lists mapped to the real names (chassis
group = instance-1 + 4 monocoque + 5 driver bodies; rear wing = 6 instances;
undertray = 7; suspension = 12; whisker = 2) and the TE sizing dropped.
Result: import → refinement regions → sizings → **surface mesh all passed**
(~2.5 h), then Improve Surface Mesh hard-stopped: "surface mesh quality is 1
… very sharp trailing edges … add a small chamfer".

The per-zone skew table is the structural diagnosis:

| zone | skewed >0.6 | max skew | faces |
|---|---|---|---|
| v0.4-step-enclosure (fluid body) | **1327** | **1.0** | 6.87 M |
| vtm_27e-undertray-instance-34 | 9 | 1.0 | 2.31 M |
| bounding-box-instance-44 | 0 | 0.52 | 3.23 M |
| car solids (wings/wheels/susp/chassis) | ~0 | <0.66 | ~8.5 M |
| **total (V0 region)** | 1346 | 1.0 | **21.7 M** |

Plus "Found overlapping faces sharing edge …", free-faces warnings, and
BOTH right wheels meshed as solids. Conclusion: **this export contains the
fluid volume AND the whole car assembly as separate overlapping solids**
(plus a redundant bounding-box body) — every car surface is meshed twice.
The specialist's journal was written for a file containing ONLY the fluid
body with face-level named selections on it (hence short labels,
`trailing-edges`, and "only fluid regions with no voids"). The V0.4-stepFC
re-export (HOOPS 24.6.0) is structurally a different package: face labels
stripped, redundant solids added. A 1:1 replay needs the specialist's
original `V0.4-step.stp`.

fc5 (job 6395029) = fc4 + curvature/proximity 0.25 mm scoped to the fluid
body. It moved the needle hard — skewed cells 1346 → 216, enclosure
1327 → 92 — but 92+5 cells stay at EXACTLY skew 1.0 (degenerate sliver
faces at the sharp trailing edges; even Improve's collapse pass at
SIQualityCollapseLimit 0.85 cannot remove them) and Improve hard-stops on
max=1.0. Cost blew up too: enclosure 6.9 M → 46.7 M faces, total 63.1 M
(4.5 h surface mesh). Fluent's own error says the fix is a CAD chamfer.
Conclusion: **the Watertight path cannot mesh this export as-is** — the
specialist's `trailing-edges` label almost certainly covered blunt TE strip
faces that pre-resolved exactly these slivers, and that label does not
exist here. Watertight full-car needs either his labelled source file or a
TE-chamfered export. → Pivot to the wing-proven FT/wrap path (fc8), which
is immune to sliver TEs and duplicate solids by construction.

fc6 (job 6395062) tested the `UseBodyLabels: 'Yes'` import-argument theory
(STEP leaf body names hyphenate to exactly the specialist's short labels):
the argument is ACCEPTED but the resulting label list is byte-identical to
the default import — it reads body-level label *attributes* from the CAD
(absent in this file), not body names. Theory falsified: with this file the
specialist's short labels can only have come from manual GUI renaming/label
creation before his recording started. The automated pipeline therefore
adapts to the file's real names (fc5) instead of reproducing his.

Fallback (if the original file is unavailable), sketched but NOT run:
import all → delete the car-solid/bounding-box meshing objects → mesh only
the enclosure. Costs: label-scoped controls are gone (wake boxes must use
the recording's absolute mm coordinates, which ARE in the journal), prisms
can only scope to the whole enclosure label (tunnel faces included), and
per-component force breakdown is lost — total forces would still be
comparison-grade. Watertight `Add Local Sizing` supports
`BOIExecution: 'Curvature'/'Proximity'` (BOIMinSize/BOIMaxSize/
BOICurvatureNormalAngle/BOICellsPerGap — Meshing.fdl) as the surgical TE
substitute: min 0.25 scoped to the wing faces resolves the wedge without
meshing the whole car at 0.25.

## ✅ Full-car FT/wrap chain — MECHANICS VALIDATED (fc8/fc9, 2026-07-17)

fc8 (job 6399932): production `mesh_fault_tolerant.jou.j2` rendered by the
real generator for the car. Two findings: (1) **FT import truncates object
names at the first dot** — 'v0.4-step-enclosure' becomes object `v0`
(export geometry without dots in names!); (2) picking the wrong wrap seed
(`bounding_box`, whose centroid sits at the car) fails fast and clean:
"Wrap region tunnel-fluid is placed too close to the geometry" (69 s).

fc9 (job 6399977): pick corrected to `v0` → **the ENTIRE chain ran
end-to-end in 1 m 23 s**: import (44 objects) → VWT → CEFB(v0, wrap) →
material point (centroid of the fluid body, lands in open fluid) → wrap →
regions → boundaries → prisms → volume → `mesh.cas.h5` (4.3 MB). Zone list:
`tunnel-fluid` cell zone + per-component wall zones (wheels.N.1,
rear_wing.N.1, driver_model.1.1, …) — the wrap is IMMUNE to the TE slivers
and duplicate solids that killed the Watertight path on this export, and it
preserves per-component zones for force breakdowns. BUT: workflow-default
sizing gave only **89,099 cells** — uselessly coarse for aero (the wing
alone was 222k).

fc10 (job 6400064) tested the flagged [needs-cluster] item: scoped
curvature+proximity controls (AddLocalSizingFTM children, min 2 / max 16 mm,
CellsPerGap 3) on the CAR objects only, ON TOP of the default control set
(probes 6377338+ proved 'Custom' REPLACES defaults and degenerates the
wrap — this adds children without touching CMCO). **✅ VALIDATED**:
2,167,045 cells in 5 m 23 s, no cells below ortho-quality 1e-4. Scoped-on-
top sizing is the FT refinement mechanism.

fc11 (job 6400208) dumped every zone's area+bbox (validated utilities) —
and exposed a geometry trap: **the 'Bounding Box' CAD body wraps into a
sealed half-box wall around the car** (zone 93148: 6.2M mm² ≈ its full
half-shell; the tunnel zone v0.1 = 249.8M mm² ≈ the BARE outer box). No
wing/undertray zones exist in the fluid mesh beyond slivers; the only
substantial car zones are the wheel portions poking through the box sides
(312k mm² each). The fc9/fc10 meshes are a car-in-a-crate — structurally
fine, aerodynamically useless. This also explains the Watertight path's
"overlapping faces" warnings, and implies the specialist deleted this body
in his GUI session (another unrecorded prep step). Domain truth from the
dump: y ∈ [0, 3208] mm (symmetry at y=0, car on +y), x ∈ [−12453, 3940]
(flow toward −x, 12.4 m wake), z ∈ [0, 3725], all mm.

fc12 (job 6400492) = fc11 + `/objects/delete` of bounding_box post-import
(hard %py-exec assert makes a failed delete abort in minutes).

## ✅ FULL-CAR PATH — COMPLETE (fc13–fc28, 2026-07-17)

**fc28 (job 6407645): the first automated full-car result. 49 m 49 s
end-to-end** — mesh (6.07 M cells) → boundary classification → slab carving
→ 750-iteration solve → converged forces. Official numbers at 15.65 m/s,
baseline BCs (stationary ground, non-rotating wheels), ×2 symmetry:
**drag 316.4 N, downforce 970.0 N, Cd 2.11 / Cl −6.47** (ref. 1.0 m²,
1.5367 m). Plateau: last-50 σ = 0.25 N drag / 3.3 N lift. Contours rendered
by a follow-up `-gu` session (fc29p) — the combined `-meshing -g` session
has no graphics (known save-picture limitation).

The winning chain and its evidence trail:

- fc13: single-syntax `/objects/delete bounding_box ()` (fc12 taught that a
  REDUNDANT second ti-menu attempt aborts — ti-menu errors are not always
  non-fatal). Crate-free mesh, 6.07 M cells, 10 min.
- fc14/fc15: post-wrap angle separation CANNOT isolate the tunnel box faces
  — the wrap rounds the 90° box edges to a few degrees per facet (139/140
  fragments, inlet+outlet+top+side stayed fused at 40° AND 15°).
- fc16: **pre-wrap CAD-shell split** (`boundary separate
  sep-face-zone-by-angle 6 40` right after import — CAD edges are still
  sharp; zone 6 = the fluid shell, id stable, assert-guarded). Wrap output
  inherits source-zone granularity (wing precedent) → 5 clean plane zones.
- fc17: ground can NEVER split by angle — it meets the wheels at
  TANGENTIAL contact patches (junction angle → 0). Area adjudication:
  the fused mega-zone = 117.4 M mm² (ground 52.6 M + top piece + car
  imprint + rims).
- fc18–fc26: solver cell-register dialog discovered stepwise (sacrificial
  prompt-chain probes): `mesh adapt cell-registers add` → name must be a
  PYTHON IDENTIFIER (hyphens rejected as "Invalid python string") →
  chooser (display-options|name|type) → `type` → (hexahedron sphere
  cylinder boundary residual volume) → per-coordinate min/max prompts in
  metres. Blank line lists a chooser; junk input ABORTS; `quit` exits one
  level. Separation: `/mesh/modify-zones/sep-face-zone-mark <zone>
  <register> yes` (the trailing flag is the confirm — `no` marks but skips).
- fc27/fc28: the mega-zone keeps a KNOWN name (`car-shell`) and the
  non-car surfaces are carved OUT of it into anonymous stray wall zones
  (ground slab z<6 mm, top slab, 40 mm rim slabs at inlet/outlet/side) —
  stray zones need no names because they default to stationary walls, the
  baseline BC. Force reports run on `thread-names car car-shell`
  (multi-zone list form works).

Accepted baseline limitations (documented): wrap TE resolution ~2 mm vs
the specialist's 0.25 mm strips; rim strips + top piece are stationary
walls; per-component force breakdown deferred. Codification of this chain
into the production templates is the next engineering task.
