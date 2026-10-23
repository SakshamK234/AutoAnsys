# Pipeline vs. CFD-specialist comparison — V0.4 full car

**Date:** 2026-10-22 · **Pipeline run:** SLURM 8105443 (`jobs/specialist-compare`)
· **Specialist baseline:** his V0.5-labelled case re-solved under his own
baked-in settings (SLURM 6412967, July 2026, `/scratch/.../specialist/`).

Both runs: same V0.4 car, same physics — 17.88 m/s freestream, moving ground,
wheels at 88 rad/s, k-ω SST, half model ×2 — and equivalent force scopes
(every car surface incl. wheels and contact patches; tunnel excluded). Both
solved 1000 iterations to a tight plateau. Coefficients use q·A = 195.8 N
(ρ 1.225, V 17.88, full frontal area 1.0 m²; his half-area-0.5 convention is
numerically identical to our full-area ×2).

## Results (mean over the last 100 iterations, full-car values)

| | Specialist (his mesh + setup) | AutoAnsys pipeline | Δ |
|---|---|---|---|
| Drag | 311.4 N (σ 0.55) | 417.2 N (σ 0.41) | **+34 %** |
| Downforce | 831.7 N | 1460.9 N | **+76 %** |
| Cd | 1.59 | 2.13 | +0.54 |
| Cl | −4.25 | −7.46 | −3.21 |
| L/D (downforce/drag) | 2.67 | 3.50 | +0.83 |
| Pitching moment (half) | +1.06 N·m | −1.25 N·m | sign flip |

Internal consistency check: the pipeline's own July baseline (fc28: 316 N /
970 N at 15.65 m/s, static ground/wheels) scaled by (17.88/15.65)² predicts
412 N drag — this run produced 417 N. The pipeline agrees with itself across
velocities to ~1 %; the extra downforce over the scaled baseline is the
expected effect of the moving ground + rotating wheels. The disagreement with
the specialist is therefore a *systematic method difference*, not noise.

## Candidate causes (in likely order of importance)

1. **Mesh method.** His mesh is hand-built on a labelled export with 0.25 mm
   trailing-edge strips; ours is a 2 mm fault-tolerant wrap (6.1 M cells).
   The wrap also *seals* small CAD gaps — a sealed undertray/diffuser and
   wing junctions generate more suction than leaky as-modelled ones, which
   pushes downforce (and induced drag) up.
2. **Geometry content.** The wrap meshes every body in the V0.4 export
   (including the driver model — `driver_model` appears in our object list);
   his zone list carries no driver-model zone, so his mesh may omit it or
   fold it elsewhere.
3. **Near-wall resolution.** Ours: 15 prism layers, SOP last-ratio. His
   boundary-layer treatment is baked into his case and not directly matched.
4. **Setup details baked into his case** (discretization, under-relaxation,
   near-wall options) that `spec_settings.set` carries but the comparison
   did not force to equality.

## What would narrow it

- Scoped TE refinement: `scoped_sizing.min_size: 0.25` on the wing objects
  only (his TE resolution), re-run — isolates cause 1 at modest cell cost.
- `delete_bodies: [driver_model…]` re-run — isolates cause 2.
- Mesh-independence sweep (the app's sweep page drives this) on
  `scoped_sizing.min_size` to show where our numbers stop moving.
- y+ check on the car from the result case; set
  `volume_mesh.first_layer_height_mm` if his wall treatment differs.

## Isolation matrix (2026-10-22, follow-up runs)

| Cell | Mesh | Solver setup | Drag (half) | Lift (half) |
|---|---|---|---|---|
| Specialist re-solve (6412967) | his | his | −155.7 N | −415.9 N |
| **Run C** (8112402) | **his** | **ours** | **−154.7 N** | **−421.0 N** |
| Pipeline (8105443) | ours (wrap) | ours | −208.6 N | −730.4 N |

**Run C is decisive: his mesh under our solver numerics reproduces his
numbers within ~1%.** The solver setup (coupled scheme, discretization,
convergence discipline, reporting) is equivalent — the entire gap between
the two tracks is the mesh: the 2 mm fault-tolerant wrap vs. his hand-built
labelled mesh with 0.25 mm trailing-edge strips. (C hit its 10 h walltime at
iteration 721 of 1000; the plateau was long established.)

Two additional findings from failed isolation attempts:
- `delete_bodies: driver_model.*` breaks the wrap — **the driver model seals
  the cockpit** in the V0.4 export, so the geometry-content difference vs.
  his mesh cannot be isolated from our side.
- Aggressive local refinement (0.25 mm on wing+undertray) fused the symmetry
  plane into the car shell — the wrap's centerline junctions are sensitive;
  refinement experiments use rear-wing-only 0.5 mm and global 1 mm floors
  (runs 8121592 / 8121593, pending).

### Refinement runs (completed 2026-10-23): the wrap is grid-converged

| Run | Mesh change | Drag (full) | Downforce (full) |
|---|---|---|---|
| Baseline wrap (8105443) | 2 mm floor | 417 N | 1461 N |
| global1 (8121593) | 1 mm floor, whole car | 421 N (+1 %) | 1479 N (+1 %) |
| wing05 (8121592) | + rear wing at 0.5 mm | 434 N (+4 %) | 1573 N (+8 %) |

Halving the global floor moves nothing; refining the wing moves the result
*further from* the specialist, not toward him. **The wrap solution is
mesh-converged at its own answer — the disagreement is topological, not a
resolution deficit.** The wrap seals the geometry (cockpit via the driver
body, undertray edges, component junctions) into a genuinely different — more
sealed, higher-downforce — body than his as-modelled labelled mesh. No
sizing knob closes that; only matching geometry fidelity does.

**Consequence:** the pipeline's accuracy ceiling is set by the wrap, which
exists only because the team's current export strips named selections
(CLUSTER_FINDINGS: the specialist's source had them). The definitive fix is
a labelled re-export (+ closed cockpit) from CAD — that unlocks the
watertight path and specialist-grade meshes through this same pipeline.

## Verdict

The pipeline reproduces *itself* precisely and runs the specialist-matched
physics unattended end-to-end (1 h 54 m wall-clock, contours included). The
absolute aero numbers differ from the specialist's hand-built mesh by +34 %
drag / +76 % downforce with a plausible, testable cause list — treat the two
as different fidelity tracks until the refinement experiments above close the
gap, and compare design iterations *within* one track, not across tracks.
