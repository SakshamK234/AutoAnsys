import type { MeshConfig, SolverConfig, SlurmConfig, CfdMode } from '@/types';
import { CFD_MODE_LABELS } from '@/lib/constants';

interface ReviewStepProps {
  name: string;
  geometryId: string;
  cfdMode: CfdMode;
  meshConfig: MeshConfig;
  solverConfig: SolverConfig;
  slurmConfig: SlurmConfig;
}

export function ReviewStep({ name, geometryId, cfdMode, meshConfig, solverConfig, slurmConfig }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Review & Submit</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Verify your simulation configuration before submitting.</p>
      </div>

      <div className="space-y-4">
        <Section title="General">
          <Row label="CFD Workflow" value={CFD_MODE_LABELS[cfdMode]} />
          <Row label="Name" value={name || '\u2014'} />
          <Row label="Geometry ID" value={geometryId || 'Not selected'} />
        </Section>

        <Section title="Mesh">
          <Row label="Surface Min/Max" value={`${meshConfig.surface_mesh.min_size} / ${meshConfig.surface_mesh.max_size} m`} />
          <Row label="Volume Max Cell" value={`${meshConfig.volume_mesh.max_cell_length} m`} />
          <Row label="Boundary Layers" value={`${meshConfig.volume_mesh.num_layers} layers, ${meshConfig.volume_mesh.first_layer_height} m first height`} />
          {meshConfig.enclosure ? (
            <Row label="Enclosure (mm)" value={`back ${meshConfig.enclosure.back_mm}, front ${meshConfig.enclosure.front_mm}, top ${meshConfig.enclosure.top_mm}, bottom ${meshConfig.enclosure.bottom_mm}, left ${meshConfig.enclosure.left_mm}, right ${meshConfig.enclosure.right_mm}`} />
          ) : (
            <Row label="Wind Tunnel" value={`X: [${meshConfig.wind_tunnel.x_min}, ${meshConfig.wind_tunnel.x_max}] Y: [${meshConfig.wind_tunnel.y_min}, ${meshConfig.wind_tunnel.y_max}] Z: [${meshConfig.wind_tunnel.z_min}, ${meshConfig.wind_tunnel.z_max}] m`} />
          )}
          <Row label="Quality Auto-Improve" value={`${meshConfig.mesh_quality.auto_improve ? 'on' : 'off'} — skew ≤ ${meshConfig.mesh_quality.surface_skewness_threshold}, ortho ≥ ${meshConfig.mesh_quality.volume_orthogonal_quality_threshold}`} />
          <Row label="Geometry Unit" value={meshConfig.geometry_unit} />
        </Section>

        <Section title="Solver">
          <Row label="Type" value={`${solverConfig.general.solver_type}, ${solverConfig.general.time}`} />
          <Row label="Turbulence" value={`${solverConfig.turbulence.model}${solverConfig.turbulence.model === 'k-omega-sst' && solverConfig.turbulence.curvature_correction ? ' + curvature correction' : ''}`} />
          <Row label="Velocity" value={`${solverConfig.boundary_conditions.velocity_inlets[0]?.velocity ?? '—'} m/s`} />
          <Row label="Reference Values" value={`area ${solverConfig.reference_values.area_m2} m², length ${solverConfig.reference_values.length_m} m, velocity ${solverConfig.reference_values.velocity_mps} m/s`} />
          <Row
            label="Boundary Conditions"
            value={
              [
                solverConfig.boundary_conditions.velocity_inlets.length && `${solverConfig.boundary_conditions.velocity_inlets.length} inlet(s)`,
                solverConfig.boundary_conditions.pressure_outlets.length && `${solverConfig.boundary_conditions.pressure_outlets.length} outlet(s)`,
                solverConfig.boundary_conditions.translating_walls.length && `${solverConfig.boundary_conditions.translating_walls.length} translating`,
                solverConfig.boundary_conditions.rotating_walls.length && `${solverConfig.boundary_conditions.rotating_walls.length} rotating`,
                solverConfig.boundary_conditions.slip_walls.length && `${solverConfig.boundary_conditions.slip_walls.length} slip`,
                solverConfig.boundary_conditions.stationary_walls.length && `${solverConfig.boundary_conditions.stationary_walls.length} no-slip`,
                solverConfig.boundary_conditions.symmetry_planes.length && `${solverConfig.boundary_conditions.symmetry_planes.length} symmetry`,
              ].filter(Boolean).join(', ') || '(none configured)'
            }
          />
          {cfdMode === 'full_car' && solverConfig.boundary_conditions.rotating_walls.length > 0 && (
            <Row
              label="Wheels"
              value={solverConfig.boundary_conditions.rotating_walls
                .map((w) => `${w.zone_name} @ ${w.omega_rad_s} rad/s`)
                .join(' · ')}
            />
          )}
          <Row label="Initialization" value={solverConfig.initialization} />
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
