import { useMemo } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import {
  TURBULENCE_MODELS, SOLVER_SCHEMES, VELOCITY_PRESETS, GRADIENT_METHODS,
  PRESSURE_SCHEMES, MOMENTUM_SCHEMES, applyCfdModeDefaults, DEFAULT_SOLVER_CONFIG,
} from '@/lib/constants';
import type {
  SolverConfig, CfdMode, BoundaryConditions, VelocityInletBC, PressureOutletBC,
  TranslatingWallBC, RotatingWallBC, SlipWallBC, StationaryWallBC, SymmetryPlaneBC,
} from '@/types';

interface SolverConfigStepProps {
  config: SolverConfig;
  setConfig: (config: SolverConfig) => void;
  cfdMode?: CfdMode;
}

// Keys of BoundaryConditions and the BC element type each holds.
type BCListKey = keyof BoundaryConditions;

const BC_KIND_META: Record<BCListKey, { label: string; description: string }> = {
  velocity_inlets:   { label: 'Velocity inlet',  description: 'Freestream velocity inlet (Fluent: velocity-inlet).' },
  pressure_outlets:  { label: 'Pressure outlet', description: 'Gauge-pressure outlet (Fluent: pressure-outlet).' },
  translating_walls: { label: 'Translating wall', description: 'Wall moving at constant velocity (e.g. ground).' },
  rotating_walls:    { label: 'Rotating wall',   description: 'Spinning wall (e.g. wheel) with origin + axis.' },
  slip_walls:        { label: 'Slip wall',       description: 'Specified-shear wall (zero shear; tunnel walls, contact patches).' },
  stationary_walls:  { label: 'Stationary wall', description: 'No-slip stationary wall (default Fluent wall).' },
  symmetry_planes:   { label: 'Symmetry plane',  description: 'Symmetry boundary.' },
};

// Factory: a fresh empty BC of the given kind. Keeps `Add` buttons one-line.
function newBC(kind: BCListKey): BoundaryConditions[BCListKey][number] {
  switch (kind) {
    case 'velocity_inlets':
      return { zone_name: 'inlet', velocity: 15.65, turbulent_intensity_pct: 5, turbulent_viscosity_ratio: 10 } satisfies VelocityInletBC;
    case 'pressure_outlets':
      return { zone_name: 'outlet', gauge_pressure: 0 } satisfies PressureOutletBC;
    case 'translating_walls':
      return { zone_name: 'ground', velocity_mps: 15.65, direction_x: -1, direction_y: 0, direction_z: 0 } satisfies TranslatingWallBC;
    case 'rotating_walls':
      return { zone_name: 'wheel', omega_rad_s: 77, origin_x: 0, origin_y: 0, origin_z: 0, axis_x: 0, axis_y: 1, axis_z: 0 } satisfies RotatingWallBC;
    case 'slip_walls':
      return { zone_name: 'tunnel-walls' } satisfies SlipWallBC;
    case 'stationary_walls':
      return { zone_name: 'walls' } satisfies StationaryWallBC;
    case 'symmetry_planes':
      return { zone_name: 'symmetry' } satisfies SymmetryPlaneBC;
  }
}

const inputCls = 'w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-2 py-1 text-xs';
const labelCls = 'block text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-0.5';

export function SolverConfigStep({ config, setConfig, cfdMode = 'individual_part' }: SolverConfigStepProps) {
  // Generic dotted-path setter for non-BC fields.
  const update = (path: string, value: any) => {
    const keys = path.split('.');
    const next: any = JSON.parse(JSON.stringify(config));
    let obj = next;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
    setConfig(next);
  };

  // Mutate a single BC in place by (kind, index, field, value).
  const updateBC = (kind: BCListKey, idx: number, field: string, value: any) => {
    const next: SolverConfig = JSON.parse(JSON.stringify(config));
    (next.boundary_conditions[kind][idx] as any)[field] = value;
    setConfig(next);
  };

  const addBC = (kind: BCListKey) => {
    const next: SolverConfig = JSON.parse(JSON.stringify(config));
    (next.boundary_conditions[kind] as any[]).push(newBC(kind));
    setConfig(next);
  };

  const removeBC = (kind: BCListKey, idx: number) => {
    const next: SolverConfig = JSON.parse(JSON.stringify(config));
    (next.boundary_conditions[kind] as any[]).splice(idx, 1);
    setConfig(next);
  };

  const setVelocity = (v: number) => {
    const next: SolverConfig = JSON.parse(JSON.stringify(config));
    next.boundary_conditions.velocity_inlets.forEach((bc) => { bc.velocity = v; });
    next.boundary_conditions.translating_walls.forEach((bc) => { bc.velocity_mps = v; });
    setConfig(next);
  };

  const loadModePreset = () => {
    // Reset BCs to empty, then re-apply preset for the active mode.
    const cleared: SolverConfig = JSON.parse(JSON.stringify(config));
    cleared.boundary_conditions = JSON.parse(JSON.stringify(DEFAULT_SOLVER_CONFIG.boundary_conditions));
    setConfig(applyCfdModeDefaults(cfdMode, cleared));
  };

  const inletVelocity = useMemo(
    () => config.boundary_conditions.velocity_inlets[0]?.velocity ?? 15.65,
    [config.boundary_conditions.velocity_inlets],
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-1">Solver Configuration</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Boundary conditions are typed lists — add as many of each kind as your zone setup needs.
        </p>
      </div>

      {/* General + turbulence */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">General</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Solver Type</label>
            <select value={config.general.solver_type} onChange={(e) => update('general.solver_type', e.target.value)} className={inputCls}>
              <option value="pressure-based">Pressure-Based</option>
              <option value="density-based">Density-Based</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Time</label>
            <select value={config.general.time} onChange={(e) => update('general.time', e.target.value)} className={inputCls}>
              <option value="steady">Steady</option>
              <option value="transient">Transient</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Turbulence Model</label>
            <select value={config.turbulence.model} onChange={(e) => update('turbulence.model', e.target.value)} className={inputCls}>
              {TURBULENCE_MODELS.map((m) => <option key={m} value={m}>{m.replace(/-/g, ' ')}</option>)}
            </select>
          </div>
        </div>
        {config.turbulence.model === 'k-omega-sst' && (
          <label className="mt-3 flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={config.turbulence.curvature_correction}
              onChange={(e) => update('turbulence.curvature_correction', e.target.checked)}
              className="h-4 w-4"
            />
            Enable curvature correction (SOP)
          </label>
        )}
      </section>

      {/* Reference Values */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Reference Values</h4>
        <div className="grid grid-cols-3 gap-4">
          <div><label className={labelCls}>Area (m²)</label><input type="number" step="0.01" value={config.reference_values.area_m2} onChange={(e) => update('reference_values.area_m2', +e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Length (m)</label><input type="number" step="0.1" value={config.reference_values.length_m} onChange={(e) => update('reference_values.length_m', +e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Velocity (m/s)</label><input type="number" step="0.01" value={config.reference_values.velocity_mps} onChange={(e) => update('reference_values.velocity_mps', +e.target.value)} className={inputCls} /></div>
        </div>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          Full-car SOP (Max Squat): area 0.65, length 2.8, velocity 15.65. Individual-part SOP: area 1.2, length 2.8.
        </p>
      </section>

      {/* Velocity Presets — also seeds inlet + ground */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Freestream Velocity</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(VELOCITY_PRESETS).map(([label, v]) => (
            <button
              key={label}
              type="button"
              onClick={() => setVelocity(v)}
              className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--accent))]"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Inlet velocity (m/s)</label>
            <input
              type="number"
              step="0.01"
              value={inletVelocity}
              onChange={(e) => setVelocity(+e.target.value)}
              className={inputCls}
            />
            <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
              Updates every velocity-inlet and translating-wall in the BC lists.
            </p>
          </div>
        </div>
      </section>

      {/* Boundary Conditions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-medium text-[hsl(var(--primary))]">Boundary Conditions</h4>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {cfdMode === 'full_car' ? 'Full-car preset: inlet, ground, front-tire, rear-tire, tunnel-walls, contact-patches.' : 'Individual-part preset: inlet, outlet, ground, walls, symmetry.'}
            </p>
          </div>
          <button
            type="button"
            onClick={loadModePreset}
            className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--accent))]"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to {cfdMode === 'full_car' ? 'Full Car' : 'Individual Part'} preset
          </button>
        </div>

        <div className="space-y-4">
          {(Object.keys(BC_KIND_META) as BCListKey[]).map((kind) => (
            <BCListCard
              key={kind}
              kind={kind}
              meta={BC_KIND_META[kind]}
              items={config.boundary_conditions[kind] as any[]}
              onAdd={() => addBC(kind)}
              onRemove={(idx) => removeBC(kind, idx)}
              onUpdate={(idx, field, value) => updateBC(kind, idx, field, value)}
            />
          ))}
        </div>
      </section>

      {/* Initialization */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Initialization</h4>
        <div className="w-72">
          <label className={labelCls}>Hybrid Initialization</label>
          <select value={config.initialization} onChange={(e) => update('initialization', e.target.value)} className={inputCls}>
            <option value="hybrid">Hybrid (specialist script: hyb-init)</option>
            <option value="hybrid-absolute">Hybrid — Absolute reference frame (older SOP)</option>
          </select>
        </div>
      </section>

      {/* Solution Methods */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Solution Methods</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Pressure-Velocity Coupling</label>
            <select value={config.solution_methods.scheme} onChange={(e) => update('solution_methods.scheme', e.target.value)} className={inputCls}>
              {SOLVER_SCHEMES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Gradient</label>
            <select value={config.solution_methods.gradient} onChange={(e) => update('solution_methods.gradient', e.target.value)} className={inputCls}>
              {GRADIENT_METHODS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Pressure</label>
            <select value={config.solution_methods.pressure} onChange={(e) => update('solution_methods.pressure', e.target.value)} className={inputCls}>
              {PRESSURE_SCHEMES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Momentum</label>
            <select value={config.solution_methods.momentum} onChange={(e) => update('solution_methods.momentum', e.target.value)} className={inputCls}>
              {MOMENTUM_SCHEMES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Convergence */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Convergence</h4>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Max Iterations</label><input type="number" value={config.convergence.max_iterations} onChange={(e) => update('convergence.max_iterations', +e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Residual Target</label><input type="number" step="0.0001" value={config.convergence.residual_target} onChange={(e) => update('convergence.residual_target', +e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Force Monitor Window</label><input type="number" value={config.convergence.force_monitor_window} onChange={(e) => update('convergence.force_monitor_window', +e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Force Monitor Tolerance</label><input type="number" step="0.001" value={config.convergence.force_monitor_tolerance} onChange={(e) => update('convergence.force_monitor_tolerance', +e.target.value)} className={inputCls} /></div>
        </div>
      </section>
    </div>
  );
}

// ── BCListCard ──────────────────────────────────────────────────────
// Renders one BC kind: header (label / count / Add button) + a row per item.

interface BCListCardProps {
  kind: BCListKey;
  meta: { label: string; description: string };
  items: any[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: string, value: any) => void;
}

function BCListCard({ kind, meta, items, onAdd, onRemove, onUpdate }: BCListCardProps) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium">{meta.label} <span className="text-[10px] font-normal text-[hsl(var(--muted-foreground))]">({items.length})</span></div>
          <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{meta.description}</div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs font-medium hover:bg-[hsl(var(--accent))]"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-[11px] italic text-[hsl(var(--muted-foreground))] py-2">None.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <BCRow
              key={idx}
              kind={kind}
              item={item}
              onChange={(field, value) => onUpdate(idx, field, value)}
              onRemove={() => onRemove(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// One editable row per BC kind. Uses a mini-grid layout — fields per kind.

interface BCRowProps {
  kind: BCListKey;
  item: any;
  onChange: (field: string, value: any) => void;
  onRemove: () => void;
}

function BCRow({ kind, item, onChange, onRemove }: BCRowProps) {
  return (
    <div className="rounded-md bg-[hsl(var(--muted)/0.4)] p-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 grid grid-cols-12 gap-2">
          {/* Zone name — every kind has it. */}
          <div className="col-span-3">
            <label className={labelCls}>Zone</label>
            <input
              type="text"
              value={item.zone_name}
              onChange={(e) => onChange('zone_name', e.target.value)}
              className={inputCls}
            />
          </div>

          {kind === 'velocity_inlets' && (
            <>
              <NumField label="Velocity (m/s)" value={item.velocity} onChange={(v) => onChange('velocity', v)} step="0.01" span={3} />
              <NumField label="TI (%)"           value={item.turbulent_intensity_pct} onChange={(v) => onChange('turbulent_intensity_pct', v)} step="0.5" span={3} />
              <NumField label="μt/μ"             value={item.turbulent_viscosity_ratio} onChange={(v) => onChange('turbulent_viscosity_ratio', v)} step="0.5" span={3} />
            </>
          )}
          {kind === 'pressure_outlets' && (
            <NumField label="Gauge Pressure (Pa)" value={item.gauge_pressure} onChange={(v) => onChange('gauge_pressure', v)} step="1" span={9} />
          )}
          {kind === 'translating_walls' && (
            <>
              <NumField label="Velocity (m/s)" value={item.velocity_mps} onChange={(v) => onChange('velocity_mps', v)} step="0.01" span={3} />
              <NumField label="Dir X" value={item.direction_x} onChange={(v) => onChange('direction_x', v)} step="0.1" span={2} />
              <NumField label="Dir Y" value={item.direction_y} onChange={(v) => onChange('direction_y', v)} step="0.1" span={2} />
              <NumField label="Dir Z" value={item.direction_z} onChange={(v) => onChange('direction_z', v)} step="0.1" span={2} />
            </>
          )}
          {kind === 'rotating_walls' && (
            <>
              <NumField label="ω (rad/s)" value={item.omega_rad_s} onChange={(v) => onChange('omega_rad_s', v)} step="0.5" span={2} />
              <NumField label="Origin X (m)" value={item.origin_x} onChange={(v) => onChange('origin_x', v)} step="0.001" span={2} />
              <NumField label="Origin Y (m)" value={item.origin_y} onChange={(v) => onChange('origin_y', v)} step="0.001" span={2} />
              <NumField label="Origin Z (m)" value={item.origin_z} onChange={(v) => onChange('origin_z', v)} step="0.001" span={2} />
              <NumField label="Axis Y" value={item.axis_y} onChange={(v) => onChange('axis_y', v)} step="0.1" span={1} />
            </>
          )}
          {/* slip / stationary / symmetry are zone-name-only */}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mt-4 rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-rose-500/10 hover:text-rose-500"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Static map so Tailwind's JIT scanner sees the col-span-N classes literally.
const COL_SPAN: Record<number, string> = {
  1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4',
  5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8',
  9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12',
};

interface NumFieldProps { label: string; value: number; onChange: (v: number) => void; step?: string; span?: number }
function NumField({ label, value, onChange, step = '1', span = 3 }: NumFieldProps) {
  return (
    <div className={COL_SPAN[span] || 'col-span-3'}>
      <label className={labelCls}>{label}</label>
      <input type="number" step={step} value={value} onChange={(e) => onChange(+e.target.value)} className={inputCls} />
    </div>
  );
}
