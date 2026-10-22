# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

FSAE aerodynamics engineers — undergraduate team members, CFD-literate, working
at laptops/desktops on campus (VPN'd to the ARC cluster). They iterate on CAD
parts (wings, undertrays, full car) and need simulation turnaround without raw
SSH/journal-file work. A team lead reviews results; occasional guests browse
read-only. Phone use is incidental status-checking, not a primary surface.

## Product Purpose

AutoAnsys turns a CAD export (Parasolid/STEP from NX or Discovery) into a
finished ANSYS Fluent CFD result on Virginia Tech's ARC TinkerCliffs cluster:
upload → mesh → solve → review forces, coefficients, convergence, and contour
images — all from the browser. Success = a teammate with no HPC experience
submits a part and gets a trustworthy Cd/Cl verdict, and the team can compare
iterations to make design decisions.

## Positioning

The only path on this team from CAD to cluster-validated aero numbers with zero
SSH: it encodes the team's probe-validated Fluent recipes (fault-tolerant wrap
meshing, geometric boundary classification, SOP boundary conditions) so results
are reproducible and comparable across members, not dependent on one
specialist's GUI session.

## Operating Context

- Jobs run as SLURM batch jobs on ARC TinkerCliffs under the shared `fsae`
  allocation; meshing minutes to ~1 h, solves minutes to hours; queue waits vary.
- Users live with long-running state: submit, walk away, come back — live stage
  progress and failure reasons must stand on their own.
- Results reviewed both as single-run verdicts (coefficients, convergence
  plateau, contours) and side-by-side comparisons of design iterations — both
  carry equal weight.
- Team collaboration via groups: shared visibility of runs within a group.
- Deployment: docker-compose on a campus-network machine; MinIO object store;
  the cluster is reached over SSH with a service key.

## Capabilities and Constraints

- Entities: Geometries (uploaded CAD), Meshes (reusable, content-hashed),
  Runs/Jobs (solver executions), Sweeps (parametric batches), Templates,
  Groups, run Profiles (`individual_part`, `full_car`).
- Run profiles carry SOP physics defaults served by `GET /api/profiles/{mode}`
  — the UI must show the resolved values that will actually run.
- Live data: WebSocket `/ws/jobs/{id}/live` emits status_update, progress
  (stage marker + iteration), residual, force, results_ready events.
- Failed runs carry `error_message` (distilled from Fluent/SLURM logs) and
  downloadable logs — failures must be diagnosable from the UI alone.
- Forces are reported both as coefficients (Cd/Cl/Cm) and Newtons; half-model
  runs are symmetry-doubled in post-processing.
- Guests are read-only; registration may be invite-coded; per-user active-run
  caps exist. SLURM account is pinned server-side.
- Terminology the team uses: "runs" (solves), "meshes", "sweeps", Cd/Cl/Cm,
  downforce (negative lift), convergence plateau, cell count, walltime, queue.

## Brand Commitments

The product name "AutoAnsys" is kept. No other binding identity: the previous
"Pit Wall" racing-telemetry look is explicitly not a constraint — the visual
world is designed from scratch (user decision, 2026-10-21). ANSYS/Fluent are
third-party trademarks and must not be imitated.

## Evidence on Hand

- Real result artifacts exist from cluster runs: forces.csv, residual history,
  contour PNGs (velocity/pressure/TKE midplane, Cp), mesh cell counts
  (e.g. wing: Cd/Cl from a 300-iteration k-ω SST solve; full car: 6.07 M cells,
  drag 316 N / downforce 970 N at 15.65 m/s).
- No testimonials/marketing claims; this is an internal team tool.

## Product Principles

1. Trust through transparency: always show what will actually run (resolved
   profile values) and what actually happened (stages, errors, logs).
2. Zero-HPC-knowledge path first, expert overrides second — defaults are the
   SOP, advanced knobs are present but out of the way.
3. Long-running work is first-class: state, progress, and failure reasons must
   read correctly after hours away.
4. Numbers people act on: coefficients with their convergence confidence, never
   a bare value without context.
5. The team's shared allocation is a commons — visibility and restraint
   (caps, cancel, reuse meshes) are part of the design.
