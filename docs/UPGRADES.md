# AutoAnsys Upgrade Roadmap

Tracked upgrades for the AutoAnsys CFD Platform, organized by impact level.

---

## High Impact (Implemented)

### 1. WebSocket Live Updates
**Status:** Done
**Files changed:** `frontend/src/pages/job-detail.tsx`

- Wired up the existing `useWebSocket` hook to the job detail page for active jobs
- Live status indicator ("Live" badge) when WebSocket is connected
- Real-time residual and force data streams merged with API polling data
- Auto-invalidates React Query cache on terminal status (completed/failed/cancelled)
- Falls back to 10s polling when WebSocket is disconnected

### 2. Enhanced Contour Image Automation
**Status:** Done
**Files changed:** `backend/app/journal/templates/mesh_watertight.jou.j2`, `backend/app/tasks/job_tasks.py`, `frontend/src/pages/job-detail.tsx`

- Added mid-plane cross-section (Z=0) for flow field visualization
- New contour outputs:
  - Velocity on mid-plane (`contour_velocity_midplane.png`)
  - Pressure on mid-plane (`contour_pressure_midplane.png`)
  - Pressure coefficient on body surfaces (`contour_cp.png`)
  - Turbulent kinetic energy on mid-plane (`contour_tke_midplane.png`)
- Updated download pipeline (`known_files`) and mock result generator
- Updated frontend contour labels

### 3. Comparison View
**Status:** Done
**Files changed:** `backend/app/api/jobs.py`, `frontend/src/pages/compare.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/sidebar.tsx`

- Backend `GET /api/jobs/compare/data?ids=id1,id2,...` endpoint (max 6 jobs)
- Frontend page at `/compare` with:
  - Job selector dropdown (completed jobs only)
  - Color-coded job chips (up to 6)
  - Final force coefficient summary cards (Cd, Cl, Cm)
  - Overlaid force charts (Cd, Cl, Cm vs iteration)
  - Overlaid residual convergence chart (log scale)
  - Configuration diff table highlighting differences

### 4. Parametric Sweeps
**Status:** Done
**Files changed:** `backend/app/api/jobs.py`, `backend/app/schemas/job.py`, `frontend/src/pages/sweep.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/sidebar.tsx`

- Backend `POST /api/jobs/sweep` endpoint creates 2-20 jobs from a base config + parameter sweep
- Schema: `SweepCreate` with `SweepParameter` (config path + values list)
- Frontend page at `/sweep` with:
  - 7 preset sweep parameters (velocity, mesh sizes, BL params, convergence)
  - Editable comma-separated value input with defaults
  - Live preview of jobs to be created
  - Optional auto-submit toggle
  - Success view with job list

---

## Medium Impact (TODO)

### 5. Admin Panel
- [ ] Manage recommended templates (`is_recommended` flag)
- [ ] User role management UI (promote to aero_lead/admin)
- [ ] Cluster configuration UI (module versions, partitions, accounts)

### 6. Group Job Dashboard
- [ ] Dedicated group-level job listing page
- [ ] Group statistics (total runs, success rate, total SU usage)
- [ ] Shared result gallery per group

### 7. Job Queue / Priority Management
- [ ] Reorder draft jobs before submission
- [ ] Priority field on jobs
- [ ] Queue position indicator on running/queued jobs

### 8. Notifications
- [ ] Email alerts on job completion/failure (Redis pub/sub events already published)
- [ ] Slack webhook integration
- [ ] In-app notification bell with unread count

### 9. Result Post-Processing
- [ ] Compute derived quantities: Cl/Cd ratio, drag breakdown by component
- [ ] Aero balance percentage (front/rear)
- [x] Reference area and coefficient normalization settings — done in the CFD
      rework (M2): `reference_values` (incl. density) + `app/post/forces.py`
      derive Cd/Cl/Cm from body-scoped forces, with the half-model symmetry factor
- [ ] Export summary CSV with key metrics across multiple jobs

### 10. Multi-Geometry Assemblies
- [ ] Support multiple geometry files per job (body + wing + undertray)
- [ ] Assembly configuration in the wizard
- [ ] Per-component force breakdowns

---

## Robustness (TODO)

### 11. Startup / Shutdown Lifecycle
- [ ] Initialize DB connection pools on startup
- [ ] Warm S3 client connections
- [ ] Graceful shutdown with in-flight request draining
- [ ] Health check with dependency status (DB, Redis, S3)

### 12. Rate Limiting
- [ ] Per-user rate limiting on API endpoints (FastAPI middleware or slowapi)
- [ ] Upload size limits and throttling
- [ ] Submission rate limiting (max concurrent jobs per user)

### 13. Retry Logic
- [ ] Implement actual Celery retry with exponential backoff
- [x] Retry on transient SSH/SFTP failures — submit tasks retry on
      socket timeouts / SSHException (`_TRANSIENT_CLUSTER_ERRORS`)
- [ ] Dead letter queue for permanently failed tasks

### 14. Centralized Logging
- [ ] Structured JSON logging (structlog or python-json-logger)
- [ ] Log aggregation (ELK stack or CloudWatch)
- [ ] Request ID tracing across FastAPI -> Celery -> cluster

### 15. Input Validation Hardening
- [ ] Validate mesh/solver configs against Fluent-supported ranges
- [x] Physics-consistency checks — `check_solver_correctness()` flags symmetry/
      force-factor mismatches, missing ground/wheels for full_car, unset
      reference values (logged at job creation)
- [ ] Pre-flight checks before submission (geometry file exists in S3, cluster reachable)
- [ ] Config schema versioning for forward compatibility

---

## Nice-to-Have (TODO)

### 16. 3D Geometry Preview
- [ ] In-browser STL/STEP viewer using Three.js or react-three-fiber
- [ ] Show geometry during wizard geometry step
- [ ] Bounding box display for wind tunnel sizing

### 17. Cost Estimation
- [ ] Estimate SU cost: nodes x cores x walltime
- [ ] Display cost estimate in review step before submission
- [ ] Monthly SU usage tracking per user/group

### 18. Job Templates from Completed Runs
- [ ] One-click "Save as Template" button on completed job detail (already implemented in Config tab)
- [ ] Auto-populate template description with key parameters
- [ ] Template diff view when updating

### 19. Mesh Independence Study Tool
- [ ] Automated coarse/medium/fine mesh sequence (uses parametric sweep infrastructure)
- [ ] Richardson extrapolation for grid convergence index
- [ ] Convergence plot (force coefficients vs mesh element count)

### 20. Export Reports
- [ ] Generate PDF summary of simulation results
- [ ] Include contour images, force/residual charts, config table
- [ ] Batch report for parametric sweeps
- [ ] Design review presentation template (PPTX export)
