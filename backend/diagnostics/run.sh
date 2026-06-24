#!/bin/bash
# Upload and run the diagnostic journal on your cluster.
# Set NETID, CLUSTER_HOST, SLURM_ACCOUNT, SSH_KEY, or export them before running.
#
# Usage:
#   export NETID=your_netid CLUSTER_HOST=cluster.example.edu SLURM_ACCOUNT=myalloc
#   bash run_diagnostic.sh

NETID="${NETID:-your_netid}"
CLUSTER_HOST="${CLUSTER_HOST:-cluster-login.example.edu}"
SLURM_ACCOUNT="${SLURM_ACCOUNT:-your_slurm_account}"
KEY="${SSH_KEY:-$HOME/.ssh/id_cluster}"
CLUSTER="${NETID}@${CLUSTER_HOST}"
REMOTE_DIR="/scratch/${NETID}/autoansys/diagnostic"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Uploading diagnostic journal (user=$NETID host=$CLUSTER_HOST) ==="
ssh -i "$KEY" "$CLUSTER" "mkdir -p $REMOTE_DIR"
scp -i "$KEY" "$SCRIPT_DIR/diagnostic_meshing.jou" "$CLUSTER:$REMOTE_DIR/"

echo "=== Creating SLURM batch script ==="
ssh -i "$KEY" "$CLUSTER" "cat > $REMOTE_DIR/run_diag.sh" <<EOF
#!/bin/bash
#SBATCH --job-name=autoansys_diag
#SBATCH --nodes=1
#SBATCH --ntasks=4
#SBATCH --ntasks-per-node=4
#SBATCH --mem=16G
#SBATCH --time=00:15:00
#SBATCH --partition=normal_q
#SBATCH --account=${SLURM_ACCOUNT}
#SBATCH --output=/scratch/${NETID}/autoansys/diagnostic/diag-%j.out
#SBATCH --error=/scratch/${NETID}/autoansys/diagnostic/diag-%j.err

cd /scratch/${NETID}/autoansys/diagnostic
module load ANSYS/2025R1
echo "Fluent version:"
fluent -v 2>&1 || true
echo ""
echo "=== Running diagnostic journal ==="
fluent meshing 3ddp -g -t4 -i diagnostic_meshing.jou 2>&1
echo "=== Done ==="
EOF

echo "=== Submitting diagnostic job ==="
ssh -i "$KEY" "$CLUSTER" "cd $REMOTE_DIR && sbatch run_diag.sh"

echo ""
echo "Monitor with: ssh -i $KEY $CLUSTER 'tail -f $REMOTE_DIR/diag-*.out'"
