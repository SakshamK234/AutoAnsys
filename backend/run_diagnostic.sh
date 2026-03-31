#!/bin/bash
# Upload and run the diagnostic journal on the cluster
# Usage: bash run_diagnostic.sh

CLUSTER="sakshamkumar@tinkercliffs1.arc.vt.edu"
KEY="$HOME/.ssh/arc_autoansys"
REMOTE_DIR="/scratch/sakshamkumar/autoansys/diagnostic"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Uploading diagnostic journal ==="
ssh -i "$KEY" "$CLUSTER" "mkdir -p $REMOTE_DIR"
scp -i "$KEY" "$SCRIPT_DIR/diagnostic_meshing.jou" "$CLUSTER:$REMOTE_DIR/"

echo "=== Creating SLURM batch script ==="
ssh -i "$KEY" "$CLUSTER" "cat > $REMOTE_DIR/run_diag.sh" <<'SLURM'
#!/bin/bash
#SBATCH --job-name=autoansys_diag
#SBATCH --nodes=1
#SBATCH --ntasks=4
#SBATCH --ntasks-per-node=4
#SBATCH --mem=16G
#SBATCH --time=00:15:00
#SBATCH --partition=normal_q
#SBATCH --account=fsae
#SBATCH --output=/scratch/sakshamkumar/autoansys/diagnostic/diag-%j.out
#SBATCH --error=/scratch/sakshamkumar/autoansys/diagnostic/diag-%j.err

cd /scratch/sakshamkumar/autoansys/diagnostic
module load ANSYS/2025R1
echo "Fluent version:"
fluent -v 2>&1 || true
echo ""
echo "=== Running diagnostic journal ==="
fluent meshing 3ddp -g -t4 -i diagnostic_meshing.jou 2>&1
echo "=== Done ==="
SLURM

echo "=== Submitting diagnostic job ==="
ssh -i "$KEY" "$CLUSTER" "cd $REMOTE_DIR && sbatch run_diag.sh"

echo ""
echo "Monitor with: ssh -i $KEY $CLUSTER 'tail -f $REMOTE_DIR/diag-*.out'"
