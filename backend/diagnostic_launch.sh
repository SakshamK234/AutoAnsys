#!/bin/bash
#SBATCH --job-name=autoansys_diag
#SBATCH --nodes=1
#SBATCH --ntasks=4
#SBATCH --ntasks-per-node=4
#SBATCH --mem=16G
#SBATCH --time=00:15:00
#SBATCH --partition=normal_q
#SBATCH --account=fsae
#SBATCH --output=/scratch/sakshamkumar/autoansys/diagnostic/launch-%j.out
#SBATCH --error=/scratch/sakshamkumar/autoansys/diagnostic/launch-%j.err

cd /scratch/sakshamkumar/autoansys/diagnostic
module load ANSYS/2025R1

echo "=== Test 1: fluent meshing 3ddp (current, broken) ==="
which fluent
echo ""

echo "=== Test 2: Check available fluent executables ==="
ls -la $(dirname $(which fluent))/../lnamd64/ 2>/dev/null | head -20
echo ""

echo "=== Test 3: fluent -help ==="
fluent -help 2>&1 | head -40
echo ""

echo "=== Test 4: Try fluent 3ddp -meshing flag ==="
echo '(%py-exec "print(workflow.TaskObject.get_object_names())")' > /tmp/quick_test.jou
echo '/exit yes' >> /tmp/quick_test.jou
timeout 120 fluent 3ddp -meshing -g -t4 -i /tmp/quick_test.jou 2>&1 | tail -30
echo "Exit: $?"
echo ""

echo "=== Test 5: Try fluent -meshing 3ddp ==="
timeout 120 fluent -meshing 3ddp -g -t4 -i /tmp/quick_test.jou 2>&1 | tail -30
echo "Exit: $?"
echo ""

echo "=== Test 6: Try switch-to-meshing-mode from solver ==="
fluent 3ddp -g -t4 -i diagnostic_meshing.jou 2>&1 | tail -50
echo "Exit: $?"
