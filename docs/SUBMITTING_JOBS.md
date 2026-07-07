# Submitting Simulation Jobs

AutoAnsys runs CFD simulations on Virginia Tech's ARC TinkerCliffs cluster in
**batch mode**: jobs are submitted to the SLURM queue via `sbatch`, may wait for
resources, and need no active session.

> An "OOD Session Mode" (running inside an existing Open OnDemand allocation via
> `srun --overlap`) was previously described here but never had a working submit
> path; its dead code was removed during the pipeline audit (AUDIT E1).

---

## Before You Start

- Upload your geometry on the **Geometries** page. Accepted formats: STEP (`.stp`/`.step`), IGES (`.igs`/`.iges`), **Parasolid (`.x_t`/`.x_b`/`.xmt_txt`/`.xmt_bin`) — recommended per SOP**, and Discovery script (`.dsco`). Per CFD_SOP Step 1, export as Parasolid for best topology fidelity.
- Have your ARC credentials configured in AutoAnsys (SSH key + username)
- Know your SLURM allocation / project account name (site-specific; replace default `your_slurm_account` in the app)

> **WARNING:** Never run Fluent on ARC login nodes (`tinkercliffs1`, `tinkercliffs2`). ARC will kill your process and may suspend your account. AutoAnsys enforces this at every level, but be aware of the policy.

---

## Method 1: Batch Mode (Submit to Queue)

Best for long-running simulations or when you don't need immediate results.

### Steps

1. Navigate to **New Job** (`/new-job`)
2. **Geometry** — Select your uploaded geometry and give the simulation a name
3. **Mesh** — Configure surface mesh sizing, volume mesh parameters, and boundary layers
4. **Solver** — Set boundary conditions (inlet velocity, outlet pressure, etc.) and convergence criteria
5. **Resources** — Select **"Submit to Queue"** and configure:

   | Field | Description | Typical Value |
   |-------|-------------|---------------|
   | Job Name | SLURM job name (shows in `squeue`) | `autoansys_cfd` |
   | Nodes | Number of compute nodes | 1 |
   | Cores per Node | CPU cores per node | 32–128 |
   | Memory per Node | RAM in GB | 64–243 |
   | Wall Time | Max run time in hours | 6–24 |
   | Partition | SLURM partition | `normal_q` |
   | Account | SLURM allocation account | `your_slurm_account` (set to your project) |

6. **Review** — Verify all settings, then click **Submit Simulation**

### What Happens on Submit

1. AutoAnsys creates a workspace on the cluster at `~/autoansys/jobs/<job_id>/`
2. Uploads the geometry file, Fluent journal files, and a SLURM batch script
3. Runs `sbatch` to submit the job to the SLURM scheduler
4. The job enters the queue (`PENDING` state) until resources are allocated
5. Once running, Fluent executes the meshing and solver journals
6. AutoAnsys polls `sacct` periodically to track status updates

### SLURM Batch Script

The generated script looks like (per-profile resources; Fluent is launched as one
MPI rank per task — `--ntasks-per-node=N --cpus-per-task=1`, **not**
`--cpus-per-task=N`, which would run silently serial):

```bash
#!/bin/bash
#SBATCH --job-name=autoansys_cfd
#SBATCH --account=fsae
#SBATCH --partition=normal_q
#SBATCH --nodes=2                 # full_car; component = 1
#SBATCH --ntasks-per-node=128
#SBATCH --cpus-per-task=1
#SBATCH --exclusive
#SBATCH --mem=243G
#SBATCH --time=24:00:00           # full_car; component = 6h
#SBATCH --output=/scratch/<user>/autoansys/jobs/<id>/slurm-%j.out

module reset
module load ANSYS/2025R1

NCORES=${SLURM_NTASKS}
scontrol show hostnames "$SLURM_JOB_NODELIST" > hostfile.txt
fluent 3ddp -g -t${NCORES} -mpi=intel -pib -cnf=hostfile.txt -i autoansys.jou
```

Workspaces live in **scratch** (`/scratch/<user>/autoansys/jobs/<id>/`), not home.

### Partitions

| Partition | Max Wall Time | Notes |
|-----------|---------------|-------|
| `normal_q` | 168 hours (7 days) | Standard partition, most jobs go here |
| `preemptable_q` | — | Lower priority, may be preempted |
| `a100_normal_q` | 168 hours | GPU nodes (A100) |
| `a100_preemptable_q` | — | Preemptable GPU nodes |

---

## Monitoring Your Job

After submission, you're redirected to the job detail page where you can:

- **Track status** — `queued` → `running` → `completed` (or `failed`)
- **View logs** — SLURM output/error logs
- **Check convergence** — Residual plots update as data becomes available
- **View results** — Force coefficients (Cd, Cl, Cm), contour images, downloadable files

### Job Statuses

| Status | Meaning |
|--------|---------|
| `draft` | Job created but not yet submitted |
| `queued` | Submitted to SLURM, waiting for resources (batch only) |
| `running` | Fluent is actively running |
| `completed` | Simulation finished successfully |
| `failed` | Error occurred (check logs for details) |
| `cancelled` | Manually cancelled by user |

---

## Cancelling a Job

AutoAnsys runs `scancel <slurm_job_id>` to cancel the SLURM job. Click the
**Cancel** button on the job detail page.

---

## Troubleshooting

### Job stuck in "queued"
The SLURM scheduler hasn't allocated resources yet. This is normal — check queue position with `squeue -u $USER` on the cluster. Busy partitions can have long wait times.

### Job fails immediately
Check the SLURM output log on the job detail page. Common causes:
- Invalid geometry file (not a valid STEP/IGES)
- Insufficient memory for the mesh size
- Fluent license unavailable
- Module load failure

For meshing failures, MPI/licensing issues, convergence stalls, and
symmetry-factor mistakes, see the fuller troubleshooting guide in
[RUNBOOK.md](RUNBOOK.md).
