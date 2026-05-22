import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeometries } from '@/hooks/use-geometries';
import { DEFAULT_MESH_CONFIG, DEFAULT_SOLVER_CONFIG, DEFAULT_SLURM_CONFIG, VELOCITY_PRESETS } from '@/lib/constants';
import { cn, formatDate } from '@/lib/utils';
import { Layers, Plus, X, Send, AlertCircle, Check, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import type { MeshConfig, SolverConfig, SlurmConfig } from '@/types';

/** Predefined sweep parameter options for FSAE CFD */
const SWEEP_PRESETS = [
  {
    label: 'Inlet Velocity',
    path: ['solver', 'boundary_conditions', 'inlet', 'velocity'],
    defaultValues: [15, 20, 25, 30],
    unit: 'm/s',
    description: 'Sweep freestream velocity (autocross to top speed)',
  },
  {
    label: 'Surface Mesh Max Size',
    path: ['mesh', 'surface_mesh', 'max_size'],
    defaultValues: [0.05, 0.08, 0.1, 0.15],
    unit: 'm',
    description: 'Mesh independence study — surface mesh refinement',
  },
  {
    label: 'Volume Max Cell Length',
    path: ['mesh', 'volume_mesh', 'max_cell_length'],
    defaultValues: [0.08, 0.1, 0.15, 0.2],
    unit: 'm',
    description: 'Mesh independence study — volume mesh refinement',
  },
  {
    label: 'BL First Layer Height',
    path: ['mesh', 'volume_mesh', 'first_layer_height'],
    defaultValues: [1e-5, 3e-5, 5e-5, 1e-4],
    unit: 'm',
    description: 'y+ sensitivity study',
  },
  {
    label: 'BL Number of Layers',
    path: ['mesh', 'volume_mesh', 'num_layers'],
    defaultValues: [8, 12, 15, 20],
    unit: 'layers',
    description: 'Boundary layer resolution study',
  },
  {
    label: 'Residual Target',
    path: ['solver', 'convergence', 'residual_target'],
    defaultValues: [1e-3, 5e-4, 1e-4, 5e-5],
    unit: '',
    description: 'Convergence sensitivity — tighter residual criteria',
  },
  {
    label: 'Max Iterations',
    path: ['solver', 'convergence', 'max_iterations'],
    defaultValues: [500, 1000, 1500, 2000],
    unit: 'iters',
    description: 'Iteration count sensitivity',
  },
] as const;

export function SweepPage() {
  const navigate = useNavigate();
  const { data: geometryData } = useGeometries();
  const geometries = geometryData?.items ?? [];

  const [baseName, setBaseName] = useState('');
  const [geometryId, setGeometryId] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customValues, setCustomValues] = useState<string>('');
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ count: number; names: string[] } | null>(null);

  const preset = selectedPreset !== null ? SWEEP_PRESETS[selectedPreset] : null;

  const parsedValues: (number | string)[] = (() => {
    if (!preset) return [];
    const raw = customValues.trim();
    if (!raw) return [...preset.defaultValues];
    return raw.split(',').map((v) => {
      const trimmed = v.trim();
      const num = Number(trimmed);
      return isNaN(num) ? trimmed : num;
    }).filter((v) => v !== '');
  })();

  const canSubmit = baseName.trim() && geometryId && preset && parsedValues.length >= 2;

  const handleSubmit = async () => {
    if (!canSubmit || !preset) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await api.post('/jobs/sweep', {
        geometry_id: geometryId,
        base_name: baseName.trim(),
        // Sweeps currently default to the Individual Part SOP workflow.
        // Full-car sweeps should be launched from the wizard until a mode
        // selector is added here.
        cfd_mode: 'individual_part',
        mesh_config: DEFAULT_MESH_CONFIG,
        solver_config: DEFAULT_SOLVER_CONFIG,
        slurm_config: DEFAULT_SLURM_CONFIG,
        sweep_param: {
          path: [...preset.path],
          values: parsedValues,
        },
        auto_submit: autoSubmit,
      });

      setResult({
        count: res.data.jobs.length,
        names: res.data.jobs.map((j: any) => j.name),
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create sweep. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parametric Sweep Created</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {result.count} jobs have been {autoSubmit ? 'created and submitted' : 'created as drafts'}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-500">
            <Check className="h-5 w-5" />
            <span className="font-semibold">Sweep created successfully</span>
          </div>
          <div className="space-y-1.5">
            {result.names.map((name, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">{i + 1}.</span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/jobs')}
            className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 transition-all"
          >
            View All Jobs
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setResult(null); setBaseName(''); setSelectedPreset(null); setCustomValues(''); }}
            className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium hover:bg-[hsl(var(--accent))] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Another Sweep
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Parametric Sweep</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Create multiple simulations varying a single parameter across a range of values
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1 text-sm text-rose-500">{error}</div>
          <button onClick={() => setError('')} className="shrink-0 text-rose-500/60 hover:text-rose-500">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Step 1: Base info */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 space-y-4">
        <h3 className="text-sm font-semibold">Base Configuration</h3>

        <div>
          <label className="block text-xs font-medium mb-1.5">Sweep Name</label>
          <input
            type="text"
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            placeholder="e.g., Wing Velocity Study"
            className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5">Geometry</label>
          <select
            value={geometryId}
            onChange={(e) => setGeometryId(e.target.value)}
            className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          >
            <option value="">Select a geometry...</option>
            {geometries.map((g) => (
              <option key={g.id} value={g.id}>
                {g.original_name} {g.component_name ? `(${g.component_name})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Step 2: Parameter selection */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 space-y-4">
        <h3 className="text-sm font-semibold">Sweep Parameter</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Choose which parameter to vary. Each value creates a separate simulation job.
        </p>

        <div className="grid gap-2">
          {SWEEP_PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => { setSelectedPreset(idx); setCustomValues(''); }}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all',
                selectedPreset === idx
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)] ring-1 ring-[hsl(var(--primary)/0.2)]'
                  : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]'
              )}
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">{p.description}</p>
              </div>
              {p.unit && (
                <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded px-1.5 py-0.5 mt-0.5">
                  {p.unit}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Values */}
      {preset && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 space-y-4">
          <h3 className="text-sm font-semibold">Sweep Values</h3>

          <div>
            <label className="block text-xs font-medium mb-1.5">
              Values (comma-separated) — defaults shown below
            </label>
            <input
              type="text"
              value={customValues}
              onChange={(e) => setCustomValues(e.target.value)}
              placeholder={preset.defaultValues.join(', ')}
              className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {parsedValues.map((v, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-[hsl(var(--primary)/0.1)] px-2.5 py-0.5 text-xs font-mono font-medium text-[hsl(var(--primary))]"
              >
                {typeof v === 'number' && v < 0.01 ? v.toExponential(0) : String(v)}
                {preset.unit ? ` ${preset.unit}` : ''}
              </span>
            ))}
          </div>

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            This will create <strong>{parsedValues.length}</strong> simulation jobs
          </p>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSubmit}
              onChange={(e) => setAutoSubmit(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs">Auto-submit all jobs to the cluster immediately</span>
          </label>
        </div>
      )}

      {/* Preview */}
      {preset && parsedValues.length >= 2 && baseName.trim() && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 space-y-3">
          <h3 className="text-sm font-semibold">Preview — Jobs to Create</h3>
          <div className="space-y-1">
            {parsedValues.map((v, i) => {
              const paramLabel = preset.path[preset.path.length - 1].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <div key={i} className="flex items-center gap-2 text-sm rounded-lg bg-[hsl(var(--background))] px-3 py-2">
                  <span className="text-[hsl(var(--muted-foreground))] text-xs font-mono w-5">{i + 1}</span>
                  <span className="font-medium">{baseName} — {paramLabel}={v}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
        >
          {submitting ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating {parsedValues.length} jobs...
            </>
          ) : (
            <>
              <Layers className="h-3.5 w-3.5" />
              Create {parsedValues.length} Jobs
            </>
          )}
        </button>
      </div>
    </div>
  );
}
