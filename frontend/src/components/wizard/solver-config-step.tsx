import { TURBULENCE_MODELS, SOLVER_SCHEMES, VELOCITY_PRESETS, GRADIENT_METHODS, PRESSURE_SCHEMES, MOMENTUM_SCHEMES } from '@/lib/constants';
import type { SolverConfig } from '@/types';

interface SolverConfigStepProps {
  config: SolverConfig;
  setConfig: (config: SolverConfig) => void;
}

export function SolverConfigStep({ config, setConfig }: SolverConfigStepProps) {
  const update = (path: string, value: any) => {
    const keys = path.split('.');
    const newConfig = JSON.parse(JSON.stringify(config));
    let obj = newConfig;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
    setConfig(newConfig);
  };

  const setVelocity = (v: number) => {
    const newConfig = JSON.parse(JSON.stringify(config));
    newConfig.boundary_conditions.inlet.velocity = v;
    newConfig.boundary_conditions.ground.velocity = v;
    setConfig(newConfig);
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-1">Solver Configuration</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Set up the ANSYS Fluent solver parameters.</p>
      </div>

      {/* General */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">General</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Solver Type</label>
            <select value={config.general.solver_type} onChange={(e) => update('general.solver_type', e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm">
              <option value="pressure-based">Pressure-Based</option>
              <option value="density-based">Density-Based</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Time</label>
            <select value={config.general.time} onChange={(e) => update('general.time', e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm">
              <option value="steady">Steady</option>
              <option value="transient">Transient</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Turbulence Model</label>
            <select value={config.turbulence.model} onChange={(e) => update('turbulence.model', e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm">
              {TURBULENCE_MODELS.map((m) => <option key={m} value={m}>{m.replace(/-/g, ' ')}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Velocity Presets */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Freestream Velocity</h4>
        <div className="flex gap-2 mb-3">
          {Object.entries(VELOCITY_PRESETS).map(([label, v]) => (
            <button
              key={label}
              onClick={() => setVelocity(v)}
              className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--accent))]"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Inlet Velocity (m/s)</label>
            <input type="number" value={config.boundary_conditions.inlet.velocity} onChange={(e) => setVelocity(+e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      {/* Boundary Conditions */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Boundary Conditions</h4>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium mb-1">Turbulent Intensity</label><input type="number" step="0.001" value={config.boundary_conditions.inlet.turbulent_intensity} onChange={(e) => update('boundary_conditions.inlet.turbulent_intensity', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Turbulent Viscosity Ratio</label><input type="number" value={config.boundary_conditions.inlet.turbulent_viscosity_ratio} onChange={(e) => update('boundary_conditions.inlet.turbulent_viscosity_ratio', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Outlet Gauge Pressure (Pa)</label><input type="number" value={config.boundary_conditions.outlet.gauge_pressure} onChange={(e) => update('boundary_conditions.outlet.gauge_pressure', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div>
            <label className="block text-xs font-medium mb-1">Ground Type</label>
            <select value={config.boundary_conditions.ground.type} onChange={(e) => update('boundary_conditions.ground.type', e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm">
              <option value="moving-wall">Moving Wall</option>
              <option value="stationary-wall">Stationary Wall</option>
            </select>
          </div>
        </div>
      </section>

      {/* Solution Methods */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Solution Methods</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Pressure-Velocity Coupling</label>
            <select value={config.solution_methods.scheme} onChange={(e) => update('solution_methods.scheme', e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm">
              {SOLVER_SCHEMES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Gradient</label>
            <select value={config.solution_methods.gradient} onChange={(e) => update('solution_methods.gradient', e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm">
              {GRADIENT_METHODS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Pressure</label>
            <select value={config.solution_methods.pressure} onChange={(e) => update('solution_methods.pressure', e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm">
              {PRESSURE_SCHEMES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Momentum</label>
            <select value={config.solution_methods.momentum} onChange={(e) => update('solution_methods.momentum', e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm">
              {MOMENTUM_SCHEMES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Convergence */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Convergence</h4>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium mb-1">Max Iterations</label><input type="number" value={config.convergence.max_iterations} onChange={(e) => update('convergence.max_iterations', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Residual Target</label><input type="number" step="0.0001" value={config.convergence.residual_target} onChange={(e) => update('convergence.residual_target', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Force Monitor Window</label><input type="number" value={config.convergence.force_monitor_window} onChange={(e) => update('convergence.force_monitor_window', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Force Monitor Tolerance</label><input type="number" step="0.001" value={config.convergence.force_monitor_tolerance} onChange={(e) => update('convergence.force_monitor_tolerance', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
        </div>
      </section>
    </div>
  );
}
