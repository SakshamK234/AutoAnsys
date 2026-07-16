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
#SBATCH --time=06:00:00
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

# Build the Fluent hostfile from the SLURM allocation so MULTI-NODE runs span
# nodes (AUDIT S1 — previously the launch had no -cnf and silently stayed on one
# node). `scontrol show hostnames` prints one hostname per node; Fluent spreads
# the -t<N> ranks across them.
HOSTFILE="/scratch/<user>/autoansys/jobs/<individual_part_job>/hostfile.txt"
scontrol show hostnames "$SLURM_JOB_NODELIST" > "$HOSTFILE"
echo "Hostfile ($(wc -l < "$HOSTFILE") node(s)):"
cat "$HOSTFILE"

# Single Fluent session. `-t${NCORES}` must match $SLURM_NTASKS — see the
# SBATCH header above.
#   start_mode=meshing → mesh-only or combined (Watertight + solver) journal
#                        opens in meshing mode; switches itself to solver later.
#   start_mode=solver  → solver-from-case journal expects to start in solver
#                        mode so /define/... TUI paths exist. Without this
#                        Fluent stays in meshing mode and rejects
#                        /define/boundary-conditions/... as "invalid command".
FLUENT_MODE_FLAG=""

# Parallel transport (F6: Intel MPI + InfiniBand on TinkerCliffs; config-driven).
# interconnect: infiniband -> -pib, ethernet -> -peth, anything else -> omitted.
MPI_FLAGS="-mpi=intel -pib -cnf=$HOSTFILE"

echo "=== Fluent Start ($(date)) — start_mode=solver ==="
echo "Launch: fluent 3ddp ${FLUENT_MODE_FLAG} -g -t${NCORES} ${MPI_FLAGS} -i autoansys.jou"
# License is provided by `module load ANSYS/2025R1` (F6). Override here only
# if your site needs explicit servers, e.g.:
#   export ANSYSLMD_LICENSE_FILE=<port@host>
#
# Anti-zombie guard (verified on ARC, docs/CLUSTER_FINDINGS.md): after a journal
# error Fluent does NOT exit — it idles at the prompt until walltime. Run it in
# the background and kill it within seconds of the abort marker appearing.
fluent 3ddp ${FLUENT_MODE_FLAG} -g -t${NCORES} ${MPI_FLAGS} -i autoansys.jou > fluent.log 2>&1 &
FLUENT_PID=$!
while kill -0 $FLUENT_PID 2>/dev/null; do
    if grep -q "An error or interrupt occurred while reading the journal" fluent.log 2>/dev/null; then
        echo "JOURNAL_ABORT_DETECTED — killing Fluent (journal error left it idling)"
        sleep 5
        kill $FLUENT_PID 2>/dev/null
        break
    fi
    sleep 15
done
wait $FLUENT_PID
FLUENT_EXIT=$?
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
