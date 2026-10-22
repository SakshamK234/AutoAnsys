# Change summary — production hardening + UI rebuild (2026-10)

Follows [CHANGES.md](CHANGES.md) (the July audit/rework) and the cluster
campaign in [CLUSTER_FINDINGS.md](CLUSTER_FINDINGS.md). Scope: make the
validated pipeline production-deployable and rebuild the UI from scratch.

## Backend — pipeline correctness

| Area | What changed |
|---|---|
| Residuals on real runs | New `app/post/transcript.py` parses the Fluent transcript (the only residual source in batch — probe 6380354): `download_results` derives `residuals.csv` from `fluent.log`, so `/residuals` works on real runs. The transcript's residual table also carries the report-def columns, so live force points come from the same parse. |
| Live progress (GUI_PLAN G1.5) | The pollers tail `fluent.log` over SFTP each tick for RUNNING jobs/meshes → `jobs.progress` / `meshes.progress` (stage marker + iteration) and `progress`/`residual`/`force` WebSocket events. |
| Failure diagnosis (G1.6) | New `error_message` columns (migration 006). FAILED/CANCELLED runs always pull logs; `failure_summary()` distills the journal-abort marker, last Fluent errors, last stage, and SLURM verdict into a sentence the UI shows. Meshes get `collect_mesh_failure`. |
| Contours on combined runs | Combined `-meshing -g` sessions have no graphics (fc28). The SLURM script now runs a second `-gu -driver null` pass (`contours.jou`, `contours_pass=True`) in the same allocation — codifies the fc29p follow-up that was never wired. The inline contour block was removed from `mesh_watertight.jou.j2` (it could only fail under `-g`). |
| Download robustness | `download_results` is idempotent (replaces rows — no more duplicate `ResultFile` crashing `/forces`), wraps errors, fetches `fluent.log`/`contours.log`/`setup.cas.h5`, and skips multi-GB case files on failed runs. |
| SLURM state handling | Map covers BOOT_FAIL/DEADLINE/REQUEUED/SUSPENDED/RESIZING/REVOKED; a stale-run reaper fails RUNNING jobs past walltime + 2 h grace. |
| Mesh integrity | SLURM COMPLETED without `mesh.cas.h5` now marks the mesh **failed** (exit-0 batch quirk) instead of leaving a hollow "completed". |
| Mesh reuse | Job-side reuse hash now hashes the post-profile-defaults config (matches `create_mesh`), so all-default configs actually hit reuse. |
| Resubmit | Keeps `mesh_id` (when the mesh is still completed) and `group_id`, and actually submits the clone. |
| Job deletion | `DELETE /api/jobs/{id}` for drafts/terminal runs, with best-effort S3 cleanup. |
| Async hygiene | Blocking paramiko moved off the event loop (`asyncio.to_thread`) in sync endpoints and `/cluster/status`; the SSH exec-deadlock (exit-status-before-read) fixed. |

## Backend — security

- **Injection closed at the schema boundary** (`app/utils/validation.py`):
  every string rendered into a journal or `#SBATCH` line is validated —
  zone names/patterns, labels, sizing names, SLURM job name/account,
  partition/mpi/interconnect allowlists, resource ranges (nodes ≤ 4,
  cores ≤ 128, mem ≤ 512 GB, walltime ≤ 96 h), `output_path` path grammar.
- **SLURM account pinned server-side** (`pinned_slurm_config`) — users size
  resources but never choose the billed allocation (G2.4).
- **Roles enforced**: guests are read-only (`require_member` on every mutating
  endpoint); `INVITE_CODE` closes registration and disables guest login.
- **Per-user active-run cap** (`MAX_ACTIVE_JOBS_PER_USER`, default 4).
- **Upload cap** (`MAX_UPLOAD_MB`, default 256) enforced while reading;
  sanitized S3 key names.
- **Startup guard**: `ENVIRONMENT=production` refuses placeholder JWT/MinIO
  secrets and wildcard CORS; `CORS_ORIGINS` is env-driven; uvicorn
  `--reload` is dev-only.
- **SSH host keys**: trust-on-first-use persisted to `known_hosts_autoansys` —
  a changed host key is rejected afterwards.
- **Compose hardening**: Postgres/Redis/MinIO console bound to 127.0.0.1
  (`MINIO_BIND` opens S3 for LAN presigned URLs); `S3_PUBLIC_ENDPOINT` signs
  browser-reachable download URLs.
- **Group-access consistency**: group members can read a shared run's files
  and live WebSocket, matching `/jobs/{id}`; sweeps traverse list indices and
  re-validate through the typed models.

## Frontend — rebuilt from scratch

New "livery" design system (see DESIGN.md): racing-blue rail, livery stripe +
car-number identity per run reused as chart/compare colors, stage-chip live
progress, verdict tiles with plateau σ, stamped terminal states, bordered
figure plates, full-bleed contour lightbox, groups page, invite-code
registration, guest read-only UX, mobile drawer nav, 404, toasts. Fixes the
known breakages: profile defaults now come from `GET /api/profiles/{mode}`,
sweep paths/units corrected, byte-based file sizes, UTC timestamps, draft
submit/delete, failure reasons + logs for failed runs, results-after-completion
race (socket outlives the status flip; refetch on `results_ready`).

## Validation

- Backend: 92 tests green (golden artifacts regenerated — diff reviewed).
- `python -m app.journal.validate` renders all artifacts for both profiles.
- Classifier-v5 acceptance run on ARC: SLURM job 8091148 (byte-identical to
  the failed July run except the v5 quoting fix + contour pass).
- **VALIDATION PASSED (2026-10-22, classifier v6):** jobs 8101759 (acceptance)
  and 8101760 (GUI smoke) both COMPLETED. The component classifier's name-based
  merge (v4/v5) was unfixable — meshing-mode renames do not survive
  switch-to-solution-mode — so v6 ports the G2-validated carve mechanism
  (merge by mesh-zone id > 1000, then name the survivor). Result, through the
  app end-to-end: RW v1.5 wing, 300 iterations, Cd −0.784 (σ 0.0002 over the
  last 100), Cl −1.903 (343 N downforce), drag 141 N at 15.65 m/s; all four
  contour PNGs from the new second-pass render; residuals charted from the
  transcript parser; verdict tiles + plateau badge live on the run page.
  (Sign convention: drag reported as the +x force component with flow in −x,
  hence negative — the magnitude is the drag.)
- Independent verification (verification session, 2026-10-22): both fluent.logs
  show zero real `Invalid Zone name` errors (the one grep hit per log is the
  v6 journal's own history comment); full marker chain through
  COMBINED_SOLVE_COMPLETE; solver zone list exactly
  inlet/outlet/ground/symmetry/farfield-top/farfield-side/body + tunnel-fluid.
  Mesh: **5,136,302 cells** (both runs). Acceptance run 8101759 (16 min,
  50 iterations): drag −68.7 N, lift −168.5 N half-model → Cd −0.763,
  Cl −1.872 — consistent with the smoke run's 300-iteration values. App side:
  `poll_active_jobs` flipped the run within one poll of SLURM completion,
  `download_results` succeeded (16 files into MinIO), job row has
  status=completed / empty error_message, and the run page renders tiles,
  residual chart and all four contours.
- Queueing lesson (2026-10-22): both validation jobs sat 24 h top-priority
  behind `#SBATCH --exclusive` — the saturated cluster had thousands of idle
  cores on *mixed* nodes, but exclusive demands a fully idle node, and
  SLURM-allocatable memory (RealMemory−AllocMem, not sinfo's FreeMem) was
  the second constraint. `--exclusive` is now removed from the SLURM
  template (the --mem/--ntasks requests already reserve the run's
  resources); the jobs were resubmitted at 96 GB as 8099228 (acceptance)
  and 8099229 (GUI smoke).
- Frontend: `tsc -b` clean; production build clean; impeccable detector clean.
