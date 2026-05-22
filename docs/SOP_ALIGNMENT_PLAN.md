# SOP Alignment Plan

Aligns the AutoAnsys configuration and Fluent journal generation with the team's two SOPs:

- **CFD_SOP (Individual Part).docx** — 3D single-part workflow
- **Kevin Full Car Reference.docx** — full-car workflow

The current code models the fluid domain as a free bounding box (x/y/z min/max in meters) with a generic velocity default of 20 m/s and 2000 iterations. The SOPs prescribe a *part-relative enclosure* in millimeters, a fixed 15.65 m/s freestream, explicit mesh-quality auto-improvement, and full-car reference values. This plan closes that gap.

---

## 1. Concepts the SOPs introduce that the repo lacks

| SOP concept | Current repo | Change |
|---|---|---|
| CFD **mode** (Individual Part vs Full Car) | implicit | add `cfd_mode: "individual_part" \| "full_car"` |
| **Enclosure** in mm (back/front/top/bottom/sides) relative to part | `WindTunnelConfig` (x/y/z min/max in m) | add `EnclosureConfig` in mm; keep WindTunnelConfig for legacy |
| Freestream **15.65 m/s** for both inlet and ground moving wall | default 20 m/s | change default to 15.65 |
| Ground moving-wall **direction vector (x=-1, y=0, z=0)** | scalar velocity only | add direction components |
| **Reference values** (area, length, velocity) | not configured | add `ReferenceValues` (area_m2, length_m, velocity_mps) |
| Full-car defaults: area 1.2 m², length 2.8 m, **wheel speed 77 rad/s** | none | add WheelBC with rotational speed per axis |
| **Curvature correction** for k-omega SST | not exposed | add `turbulence.curvature_correction` toggle, wired in journal |
| Surface-mesh **skewness threshold 0.6** (auto-improve if exceeded) | not done | add `mesh_quality.surface_skewness_threshold`, emit improve-surface-mesh task |
| Volume-mesh **orthogonal-quality threshold 0.15** (auto-improve if exceeded) | not done | add `mesh_quality.volume_orthogonal_quality_threshold`, emit improve-volume-mesh task |
| Named local refinements (Nearfield / Farfield / Rear Wing) and local sizings (Aero / Chassis / Wheels / Intake) | free-form region list | add presets that seed LocalSizingRegion entries with SOP-recommended names/categories |
| **Hybrid-absolute** initialization | `hyb-initialization` only | add `solver.initialization = "hybrid-absolute"` |
| Iterations: **300 (part)** / **3000 (full car)** | default 2000 | mode-driven defaults |
| Geometry units: **mm** per SOP | default `m` | keep `m` default, switch mode-preset default to `mm` |

## 2. Backend changes

### `backend/app/schemas/job.py`
- **`EnclosureConfig`** (new): `back_mm`, `front_mm`, `top_mm`, `bottom_mm`, `left_mm`, `right_mm`. Defaults 8000 / 1000 / 2500 / 2500 / 2500 / 2500.
- **`MeshQuality`** (new): `surface_skewness_threshold: float = 0.6`, `volume_orthogonal_quality_threshold: float = 0.15`, `auto_improve: bool = True`.
- **`LocalSizingRegion`**: add optional `category: "aero"|"chassis"|"wheels"|"intake"|"nearfield"|"farfield"|"rear_wing"|None`.
- **`ReferenceValues`** (new): `area_m2: float = 1.2`, `length_m: float = 2.8`, `velocity_mps: float = 15.65`.
- **`TurbulenceConfig`**: add `curvature_correction: bool = True`.
- **`InletBC`**: default `velocity = 15.65`.
- **`GroundBC`**: default `velocity = 15.65`; add `direction_x = -1.0, direction_y = 0.0, direction_z = 0.0`.
- **`WheelBC`** (new): `zone_names: list[str] = []`, `rotational_speed_rad_s: float = 77.0`, `axis_x/y/z = 0, 1, 0`.
- **`BoundaryConditions`**: add `wheels: WheelBC` (optional, only used when `cfd_mode == "full_car"`).
- **`SolverConfig`**: add `reference_values: ReferenceValues`, `initialization: "hybrid" | "hybrid-absolute" = "hybrid-absolute"`.
- **`MeshConfig`**: add `enclosure: EnclosureConfig | None`, `mesh_quality: MeshQuality`. Leave `wind_tunnel` for existing jobs.
- **`JobCreate`** & **`SweepCreate`**: add `cfd_mode: "individual_part" | "full_car" = "individual_part"`.

### `backend/app/journal/templates/mesh_watertight.jou.j2`
- Consume `enclosure` (mm → m) when present; fall back to `wind_tunnel`.
- After surface mesh: if `mesh_quality.auto_improve`, insert an `improve-surface-mesh` task with the skewness threshold.
- After volume mesh: if `mesh_quality.auto_improve`, insert `improve-volume-mesh` with the orthogonal-quality threshold.
- Emit `/define/models/viscous/turbulence-expert/kw-sst-enable-curvature-correction? yes` when `turbulence.curvature_correction` is true.
- Emit `/report/reference-values/area`, `length`, `velocity` from `reference_values`.
- Moving-wall command: pass three direction components from `ground.direction_*`.
- For `cfd_mode == "full_car"`, loop over `wheels.zone_names` and emit `/define/boundary-conditions/set/wall <zone> ... motion-bc-moving yes yes yes <axis> omega <rad_s>`.
- Initialization: switch between `hyb-initialization` and `hyb-initialization` + `/solve/set/hybrid-initialization/absolute? yes` when `initialization == "hybrid-absolute"`.
- Iteration count already parameterized; just adjust defaults via config.

## 3. Frontend changes

### `frontend/src/types/index.ts`
Mirror the schema additions: `CfdMode`, `EnclosureConfig`, `MeshQuality`, `ReferenceValues`, `WheelBC`, `TurbulenceConfig.curvature_correction`, `GroundBC.direction_*`, `SolverConfig.reference_values`, `SolverConfig.initialization`, `MeshConfig.enclosure`, `MeshConfig.mesh_quality`.

### `frontend/src/lib/constants.ts`
- `DEFAULT_ENCLOSURE`: {back: 8000, front: 1000, top: 2500, bottom: 2500, left: 2500, right: 2500}.
- `VELOCITY_PRESETS`: add `'FSAE SOP (15.65)': 15.65`.
- `DEFAULT_MESH_CONFIG`: add `enclosure`, `mesh_quality`. Default surface mesh growth/curvature unchanged.
- `DEFAULT_SOLVER_CONFIG`:
  - `turbulence.curvature_correction: true`
  - `reference_values: { area_m2: 1.2, length_m: 2.8, velocity_mps: 15.65 }`
  - `initialization: 'hybrid-absolute'`
  - `boundary_conditions.inlet.velocity: 15.65`
  - `boundary_conditions.ground.velocity: 15.65`, direction `x:-1, y:0, z:0`
  - `boundary_conditions.wheels: { zone_names: [], rotational_speed_rad_s: 77, axis_x:0, axis_y:1, axis_z:0 }`
  - `convergence.max_iterations: 300` (wizard selects 3000 when mode=full_car)
- `FSAE_FULL_CAR_PRESET` and `FSAE_INDIVIDUAL_PART_PRESET` bundled configs applied by a mode selector on step 0.
- `LOCAL_SIZING_CATEGORIES`: labels for `aero / chassis / wheels / intake / nearfield / farfield / rear_wing`.

### `frontend/src/components/wizard/job-wizard.tsx`
- Add `cfdMode` state (`individual_part` | `full_car`).
- Default configs applied on mode change.
- Pass `cfd_mode` to `POST /jobs`.

### `frontend/src/components/wizard/geometry-step.tsx`
- Add mode picker (two radio cards: Individual Part / Full Car).

### `frontend/src/components/wizard/mesh-config-step.tsx`
- Replace the 6-field m-based bounding box with an **Enclosure** block (back/front/top/bottom/left/right in mm), matching SOP language. Presets: "Individual Part (SOP defaults)", "Full Car (front 1000mm)".
- Add a **Mesh Quality** section with the two thresholds and the auto-improve toggle.
- Rename "Local Sizing" category dropdown to match SOP labels.

### `frontend/src/components/wizard/solver-config-step.tsx`
- Add **Reference Values** block (area / length / velocity).
- Add **Curvature correction** checkbox on turbulence.
- Change "Freestream Velocity" default to 15.65; ground-type already there; expose direction (x/y/z).
- Add **Wheels** section (zone names, rad/s, axis) shown only when `cfd_mode == "full_car"`.
- Add **Initialization** dropdown (`hybrid` / `hybrid-absolute`).

### `frontend/src/components/wizard/review-step.tsx`
- Surface the SOP-relevant fields: CFD mode, enclosure (mm), reference values, curvature correction, wheel speed (if full car), initialization, mesh-quality thresholds.

## 4. Out of scope (tracked, not done in this change)

- Persisting `cfd_mode` on `jobs` table (currently carried in config JSON). Low-cost migration to add later.
- Discovery-style enclosure box preview (would require the 3D viewer upgrade listed in UPGRADES.md #16).
- Validation that selected local-sizing categories cover what the SOP requires for the chosen mode.

## 5. Implementation order

1. Schemas (`backend/app/schemas/job.py`).
2. Journal template (`backend/app/journal/templates/mesh_watertight.jou.j2`).
3. Frontend types + constants.
4. Wizard steps (geometry → mesh → solver → review).
5. Smoke: `npx vite build` and `python -c "from app.main import app"`.
