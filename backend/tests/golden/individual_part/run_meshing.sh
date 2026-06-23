#!/bin/bash
#SBATCH --job-name=autoansys_cfd
#SBATCH --account=your_slurm_account
#SBATCH --partition=normal_q
#SBATCH --nodes=1
#
# IMPORTANT: Fluent runs MPI parallel — one rank per core. ARC schedulers
# bind by *task*, not by cpus-per-task threads, so each MPI rank must be its
# own SLURM task or they all collapse onto one core slot.
# WRONG (silently serial):  --ntasks-per-node=1 --cpus-per-task=N
# RIGHT:                    --ntasks-per-node=N --cpus-per-task=1
#SBATCH --ntasks-per-node=128
#SBATCH --cpus-per-task=1
#SBATCH --exclusive
#SBATCH --mem=243G
#SBATCH --time=24:00:00
#SBATCH --output=/scratch/<user>/autoansys/jobs/<individual_part_job>/slurm-%j.out
#SBATCH --error=/scratch/<user>/autoansys/jobs/<individual_part_job>/slurm-%j.err

# ===========================================================================
# AutoAnsys CFD Job — runs on an ARC compute node (NEVER on login nodes).
#
# Core-count guidance:
#   • Meshing (Watertight): mostly single-threaded — diminishing returns past
#     ~16 cores. 64–128 cores actually slow it down due to MPI overhead.
#   • Solver (steady RANS):  scales well to a full node (64–128 cores).
# Use mesh-only jobs with cores_per_node=16, then solver jobs with 64–128.
# ===========================================================================

set -euo pipefail

# Total MPI ranks available (= ntasks). Fluent's `-t` flag must match this.
NCORES=${SLURM_NTASKS:-128}

echo "=== AutoAnsys Job Start: $(date) ==="
echo "Job ID:        $SLURM_JOB_ID"
echo "Node(s):       $SLURM_NODELIST"
echo "Total ranks:   $NCORES  (SLURM_NTASKS)"
echo "Per-node ranks: ${SLURM_NTASKS_PER_NODE:-?}  (SLURM_NTASKS_PER_NODE)"
echo "Threads/task:  ${SLURM_CPUS_PER_TASK:-1}  (should be 1 for Fluent MPI)"
echo "Partition:     $SLURM_JOB_PARTITION"
echo "Workspace:     /scratch/<user>/autoansys/jobs/<individual_part_job>"

cd /scratch/<user>/autoansys/jobs/<individual_part_job>
module reset
module load ANSYS/2025R1

echo "Fluent binary: $(which fluent)"
echo ""

# Single Fluent session. `-t${NCORES}` must match $SLURM_NTASKS — see the
# SBATCH header above.
#   start_mode=meshing → mesh-only or combined (Watertight + solver) journal
#                        opens in meshing mode; switches itself to solver later.
#   start_mode=solver  → solver-from-case journal expects to start in solver
#                        mode so /define/... TUI paths exist. Without this
#                        Fluent stays in meshing mode and rejects
#                        /define/boundary-conditions/... as "invalid command".
FLUENT_MODE_FLAG="-meshing"
echo "=== Fluent Start ($(date)) — start_mode=meshing ==="
fluent 3ddp ${FLUENT_MODE_FLAG} -g -t${NCORES} -i autoansys.jou 2>&1 | tee fluent.log
FLUENT_EXIT=${PIPESTATUS[0]}
echo "Fluent exit code: $FLUENT_EXIT"
if [ $FLUENT_EXIT -ne 0 ]; then
    echo "FLUENT_FAILED (exit code $FLUENT_EXIT)"
    echo "Last 50 lines of output:"
    tail -50 fluent.log
    exit $FLUENT_EXIT
fi

echo ""
echo "=== AutoAnsys Job Complete: $(date) ==="
echo "Result files:"
ls -lh /scratch/<user>/autoansys/jobs/<individual_part_job>/
echo "JOB_COMPLETE"
