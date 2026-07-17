# GUI Plan — team-launchable AutoAnsys

Goal: any team member opens a browser, uploads (or picks) a geometry, chooses
a run profile, clicks Launch, and gets forces/coefficients/contours back —
with the cluster campaign's validated pipeline underneath, not the mock.

## Where the GUI stands today

The app is architecturally complete but has never touched the real cluster:

| Layer | State |
|---|---|
| Auth | JWT register/login/guest/refresh — working |
| Wizard | 5 steps (geometry → mesh → solver → resources → review), profile-driven via `GET /api/profiles` |
| Cluster layer | Real paramiko SSH/SFTP/SLURM managers exist but **`CLUSTER_MOCK_MODE=True`** everywhere; only the mock has ever run |
| Orchestration | Celery submit → beat-poll → download-results chain, WebSocket job events |
| Results UX | Force/residual charts, contour gallery (already maps the new `*_midplane.png` names), compare + sweep pages |
| Config truth | `.env` placeholders (`cluster-login.example.edu`, `your_netid`) |

## G1 — Real-cluster wiring (the mock→ARC flip)

1. `.env` for ARC: `CLUSTER_HOST=tinkercliffs1.arc.vt.edu`, service user,
   `CLUSTER_KEY_PATH`, `CLUSTER_WORKSPACE_BASE=/scratch/<user>/autoansys/jobs`,
   `CLUSTER_ACCOUNT=fsae`, `CLUSTER_MOCK_MODE=false`.
2. Validate paramiko against ARC key auth (CLI ssh with the same key is
   proven non-interactive; paramiko needs a live check).
3. Harden `poll_active_jobs` against real `squeue`/`sacct` output (formats
   verified in the probe campaign) and map SLURM states → job states.
4. `download_results` real path: pull `forces.csv`, `result.cas.h5` (opt-in,
   large), `setup.cas.h5`, all PNGs, `fluent.log` tail → MinIO.
5. **Stage-marker progress**: the journals print `(display "…_DONE")`
   markers; the poll task greps the remote `fluent.log` for them and
   publishes granular progress (Import → Mesh → Solve iteration N → Post)
   over the existing WebSocket. This is the single biggest UX win and reuses
   the exact mechanism the probe watchers use.
6. Surface the anti-zombie guard verdict (`JOURNAL_ABORT_DETECTED`) as a
   first-class failure state with the relevant log excerpt in the UI.

Gate: **GUI smoke test** — wing Parasolid uploaded through the browser,
real ARC run, forces + sideways contours rendered on the job page. This
re-runs the already-passed wing acceptance, end-to-end through the app.

## G2 — Pipeline-truth sync

1. Codify the fc-series full-car recipe into the production templates
   (already queued from the cluster campaign): junk-body deletion, pre-wrap
   CAD-shell split, scoped-on-top FT sizing, geometric boundary classifier +
   scheme, slab-carve stage, full-car solver block. The GUI inherits it
   automatically because journals render from the same generator.
2. Wizard honesty labels: `individual_part` = "validated end-to-end";
   `full_car` = "validated recipe, baseline BCs (stationary ground/wheels)
   until comparison conditions land".
3. Mesh step advanced panel: expose the new schema fields (workflow
   override, refinement regions, prism labels, poly-hexcore) read-only-by-
   default with profile presets; editable under an "Advanced" toggle so
   non-CFD teammates can't wander into foot-gun territory.
4. Per-profile SLURM presets shown (nodes/walltime) with account `fsae`
   pinned server-side — users can shrink but not exceed caps.

## G3 — Results UX

1. Forces card: production parser output (×2 symmetry factor applied,
   Cd/Cl/Cm derived) + a convergence badge from the last-50-iteration σ
   (the plateau test used in acceptance).
2. Contour gallery: sideways midplane views + Cp; lightbox + download.
3. "Download bundle" (forces.csv + PNGs + run metadata JSON); case/data
   files listed with sizes, fetched on demand only.
4. Compare page fed by real runs (baseline vs specialist-conditions run).

## G4 — Team deployment & access

1. One shared deployment via docker compose on a machine that can reach ARC
   (VPN/campus network is a hard requirement — ARC SSH is not reachable
   from off-network). Candidates: a lab PC that stays on, or the
   maintainer's machine as interim.
2. Single **service SSH key** for cluster access (all jobs run as one ARC
   account, billed to `fsae`); per-user identity lives at the app layer
   (JWT accounts, per-user job ownership already modeled). Per-user ARC
   credentials are explicitly out of scope v1.
3. Onboarding: registration open by invite link; guest mode read-only.
4. RUNBOOK section: "launch the stack", "add a teammate", "rotate the key",
   "what to do when a job dies" (anti-zombie excerpt, requeue button).

## G5 — Robustness

1. Cancel button → `scancel` (manager method exists; wire + test).
2. Requeue-from-mesh: reuse `mesh.cas.h5` via the existing split workflow
   so a solver tweak doesn't re-mesh.
3. Walltime/queue guardrails per profile; disk hygiene task for MinIO and
   `/scratch` workspaces (age-based cleanup with keep-pinned).
4. Failure taxonomy in the UI: queue-pending vs journal-abort vs walltime
   vs download failure, each with the next action spelled out.

## Sequencing & effort

| Order | Milestone | Size | Dependency |
|---|---|---|---|
| 1 | G1 wiring + wing GUI smoke test | ~1 day | none (wing path proven) |
| 2 | G2.1 codification | ~1 day | fc28 outcome (recipe frozen) |
| 3 | G3 results UX | ~0.5 day | G1 |
| 4 | G2.2-4 wizard sync | ~0.5 day | G2.1 |
| 5 | G4 deployment | ~0.5 day + host decision | G1 |
| 6 | G5 robustness | incremental | G1 |

## Open decisions (maintainer)

1. **Deployment host** — lab machine vs maintainer's PC vs each member
   running compose locally (all need VPN; shared host strongly preferred).
2. **Service account** — whose ARC key does the backend use? (Current
   campaign key works; a dedicated service key on the `fsae` allocation is
   cleaner long-term.)
3. **Who can register** — open link vs maintainer-created accounts.
