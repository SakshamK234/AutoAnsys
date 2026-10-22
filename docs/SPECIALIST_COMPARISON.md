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

## Verdict

The pipeline reproduces *itself* precisely and runs the specialist-matched
physics unattended end-to-end (1 h 54 m wall-clock, contours included). The
absolute aero numbers differ from the specialist's hand-built mesh by +34 %
drag / +76 % downforce with a plausible, testable cause list — treat the two
as different fidelity tracks until the refinement experiments above close the
gap, and compare design iterations *within* one track, not across tracks.
