import type { MeshConfig, SolverConfig, SlurmConfig } from '@/types';

interface ReviewStepProps {
  name: string;
  geometryId: string;
  meshConfig: MeshConfig;
  solverConfig: SolverConfig;
  slurmConfig: SlurmConfig;
}

export function ReviewStep({ name, geometryId, meshConfig, solverConfig, slurmConfig }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Review & Submit</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Verify your simulation configuration before submitting.</p>
      </div>

      <div className="space-y-4">
        <Section title="General">
          <Row label="Name" value={name || '\u2014'} />
          <Row label="Geometry ID" value={geometryId || 'Not selected'} />
        </Section>

        <Section title="Mesh">
          <Row label="Surface Min/Max" value={`${meshConfig.surface_mesh.min_size} / ${meshConfig.surface_mesh.max_size} m`} />
          <Row label="Volume Max Cell" value={`${meshConfig.volume_mesh.max_cell_length} m`} />
          <Row label="Boundary Layers" value={`${meshConfig.volume_mesh.num_layers} layers, ${meshConfig.volume_mesh.first_layer_height} m first height`} />
          <Row label="Wind Tunnel" value={`X: [${meshConfig.wind_tunnel.x_min}, ${meshConfig.wind_tunnel.x_max}] Y: [${meshConfig.wind_tunnel.y_min}, ${meshConfig.wind_tunnel.y_max}] Z: [${meshConfig.wind_tunnel.z_min}, ${meshConfig.wind_tunnel.z_max}] m`} />
          <Row label="Geometry Unit" value={meshConfig.geometry_unit} />
        </Section>

        <Section title="Solver">
          <Row label="Type" value={`${solverConfig.general.solver_type}, ${solverConfig.general.time}`} />
          <Row label="Turbulence" value={solverConfig.turbulence.model} />
          <Row label="Velocity" value={`${solverConfig.boundary_conditions.inlet.velocity} m/s`} />
          <Row label="Scheme" value={solverConfig.solution_methods.scheme} />
          <Row label="Iterations" value={String(solverConfig.convergence.max_iterations)} />
          <Row label="Residual Target" value={String(solverConfig.convergence.residual_target)} />
        </Section>

        <Section title="Resources">
          <Row label="Job Name" value={slurmConfig.job_name} />
          <Row label="Nodes x Cores" value={`${slurmConfig.nodes} \u00d7 ${slurmConfig.cores_per_node} = ${slurmConfig.nodes * slurmConfig.cores_per_node} cores`} />
          <Row label="Memory" value={`${slurmConfig.memory_gb} GB/node`} />
          <Row label="Wall Time" value={`${slurmConfig.walltime_hours} hours`} />
          <Row label="Partition" value={slurmConfig.partition} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[hsl(var(--border))] p-4">
      <h4 className="mb-3 text-sm font-semibold text-[hsl(var(--primary))]">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
