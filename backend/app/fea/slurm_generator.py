"""Generate SLURM batch scripts for FEA jobs."""

from __future__ import annotations


def _get_solver_command(solver: str, input_stem: str) -> str:
    solver_lower = solver.lower()
    if solver_lower == "calculix" or solver_lower == "ccx":
        return f"ccx -i {input_stem}"
    if solver_lower == "code_aster" or solver_lower == "codeaster":
        return f"as_run {input_stem}.inp"
    return f"ccx -i {input_stem}"


def generate_slurm_script(
    job_id: str,
    job_name: str,
    arc_settings: dict,
    work_dir: str,
    solver: str,
    solver_module: str,
) -> str:
    """Build a SLURM batch script string for an FEA job."""
    partition = arc_settings.get("partition", "standard")
    nodes = arc_settings.get("nodes", 1)
    tasks_per_node = arc_settings.get("tasks_per_node", 8)
    walltime = arc_settings.get("walltime", "01:00:00")

    job_work_dir = f"{work_dir}/{job_id}"
    solver_cmd = _get_solver_command(solver, job_name)

    return f"""#!/bin/bash
#SBATCH --job-name={job_name}
#SBATCH --partition={partition}
#SBATCH --nodes={nodes}
#SBATCH --ntasks-per-node={tasks_per_node}
#SBATCH --time={walltime}
#SBATCH --output={job_work_dir}/{job_name}_%j.out
#SBATCH --error={job_work_dir}/{job_name}_%j.err

module purge
module load {solver_module}

cd {job_work_dir}

{solver_cmd}

echo "FEA_JOB_COMPLETE"
"""
