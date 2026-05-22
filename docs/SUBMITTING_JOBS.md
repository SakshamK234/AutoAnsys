# Submitting Simulation Jobs

AutoAnsys supports two ways to run CFD simulations on Virginia Tech's ARC TinkerCliffs cluster:

1. **Batch Mode** — Submit to the SLURM queue via `sbatch`. May wait in queue but requires no active session.
2. **OOD Session Mode** — Run instantly on an existing Open OnDemand interactive session using `srun --overlap`.

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

The generated script looks like:

```bash
#!/bin/bash
#SBATCH --job-name=autoansys_cfd
#SBATCH --account=your_slurm_account
#SBATCH --partition=normal_q
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=1
#SBATCH --cpus-per-task=128
#SBATCH --mem=243G
#SBATCH --time=12:00:00
#SBATCH --output=slurm-%j.out
#SBATCH --error=slurm-%j.err

module reset
module load Ansys/2025R1

fluent 3ddp -t${SLURM_CPUS_PER_TASK} -g -i mesh_watertight.jou
```

### Partitions

| Partition | Max Wall Time | Notes |
|-----------|---------------|-------|
| `normal_q` | 168 hours (7 days) | Standard partition, most jobs go here |
| `preemptable_q` | — | Lower priority, may be preempted |
| `a100_normal_q` | 168 hours | GPU nodes (A100) |
| `a100_preemptable_q` | — | Preemptable GPU nodes |

---

## Method 2: OOD Session Mode (Instant Start)

Best for quick iterations when you already have an interactive session running on ARC Open OnDemand.

### Prerequisites

You need an active interactive session on [ARC Open OnDemand](https://ood.arc.vt.edu):

1. Log in to **https://ood.arc.vt.edu**
2. Go to **Interactive Apps** > **TinkerCliffs Desktop** (or any compute session)
3. Request resources (cores, memory, time) and launch
4. Once the session starts, note the **compute node name** from the session URL:
   ```
   https://ood.arc.vt.edu/rnode/tc064/42897/...
                                   ^^^^^
                              This is your compute node
   ```

### Steps

1. Navigate to **New Job** (`/new-job`)
2. Configure **Geometry**, **Mesh**, and **Solver** as usual
3. **Resources** — Select **"Run on OOD Session"** and enter:

   | Field | Description | Example |
   |-------|-------------|---------|
   | Compute Node | Node name from your OOD session URL | `tc064` |
   | Cores | Number of cores to use (match your OOD allocation) | 32 |

4. **Review** — Verify settings, then click **Launch on OOD Session**

### What Happens on Submit

1. AutoAnsys SSHs to the ARC login node, then jumps to your compute node via ProxyJump
2. Verifies your compute node has an active SLURM allocation by checking `squeue`
3. Creates the workspace and uploads files to the compute node
4. Launches Fluent using your existing allocation:
   ```bash
   srun --jobid=<YOUR_SLURM_JOB_ID> --overlap -N1 -n1 -c32 \
     fluent 3ddp -t32 -g -i mesh_watertight.jou
   ```
5. Monitors the process directly (PID-based) instead of polling SLURM

### Why `srun --overlap`?

Your OOD session already has a SLURM allocation. Using `srun --jobid=... --overlap` runs Fluent **within** that existing allocation without conflicting with the parent OOD job. This means:

- No queue wait — starts immediately
- Uses resources from your existing allocation
- Proper SLURM accounting (the work is tracked under your allocation)

### Finding Your Compute Node

Your OOD session URL contains the compute node name:

```
https://ood.arc.vt.edu/rnode/tc064/42897/vnc.html
                                ^^^^^
```

Valid compute node names match the pattern `tc` followed by 3-4 digits (e.g., `tc064`, `tc1023`).

**Do NOT enter:**
- `tinkercliffs1` or `tinkercliffs2` — these are **login nodes**, not compute nodes
- Random hostnames — must be an active TinkerCliffs compute node

AutoAnsys will reject login node names and invalid compute node names at submission time.

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

- **Batch mode:** AutoAnsys runs `scancel <slurm_job_id>` to cancel the SLURM job
- **OOD session mode:** AutoAnsys kills the Fluent process on the compute node

Click the **Cancel** button on the job detail page.

---

## Troubleshooting

### "That is a LOGIN node" error
You entered `tinkercliffs1` or `tinkercliffs2` as the compute node. These are login nodes — enter the compute node from your OOD session URL instead (e.g., `tc064`).

### "Invalid compute node name" error
The node name doesn't match the expected pattern (`tc` + 3-4 digits). Double-check your OOD session URL.

### "No active SLURM allocation found" error
Your OOD session may have expired or the node doesn't have a running job under your user. Check `squeue --me` on the cluster or launch a new OOD session.

### Job stuck in "queued" (batch mode)
The SLURM scheduler hasn't allocated resources yet. This is normal — check queue position with `squeue -u $USER` on the cluster. Busy partitions can have long wait times.

### Job fails immediately
Check the SLURM output log on the job detail page. Common causes:
- Invalid geometry file (not a valid STEP/IGES)
- Insufficient memory for the mesh size
- Fluent license unavailable
- Module load failure

### OOD session timed out mid-run
If your OOD session's walltime expires while Fluent is running, the job will fail. Request enough walltime in your OOD session to cover the full simulation.
