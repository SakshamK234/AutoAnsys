import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorText } from '../lib/api';
import { useGeometries } from '../lib/queries';
import { useAuth, isGuest } from '../stores/auth';
import { PageHeader } from '../components/chrome';
import { Button, Field, Input, Panel, Select, useToast } from '../components/ui';
import { Stripe } from '../components/livery';
import type { CfdMode, Job } from '../types';

interface Preset {
  key: string;
  label: string;
  unit: string;
  path: string[];
  defaults: string;
  note?: string;
}

/** Paths verified against the backend schema (velocity_inlets is a list —
 * the index is a path segment). */
const PRESETS: Preset[] = [
  {
    key: 'velocity',
    label: 'Inlet velocity',
    unit: 'm/s',
    path: ['solver', 'boundary_conditions', 'velocity_inlets', '0', 'velocity'],
    defaults: '12, 15.65, 20, 25',
    note: 'Reference velocity and moving ground stay at the profile value — coefficients compare at the profile normalization.',
  },
  {
    key: 'surf_max',
    label: 'Surface mesh max size',
    unit: 'mm',
    path: ['mesh', 'surface_mesh', 'max_size'],
    defaults: '200, 264, 330',
  },
  {
    key: 'surf_min',
    label: 'Surface mesh min size',
    unit: 'mm',
    path: ['mesh', 'surface_mesh', 'min_size'],
    defaults: '1.5, 2, 3',
  },
  {
    key: 'layers',
    label: 'Prism layers',
    unit: 'layers',
    path: ['mesh', 'volume_mesh', 'num_layers'],
    defaults: '10, 15, 20',
  },
  {
    key: 'first_layer',
    label: 'First prism layer height',
    unit: 'mm',
    path: ['mesh', 'volume_mesh', 'first_layer_height_mm'],
    defaults: '0.02, 0.05, 0.1',
  },
  {
    key: 'iters',
    label: 'Iterations',
    unit: 'iters',
    path: ['solver', 'convergence', 'max_iterations'],
    defaults: '300, 600, 900',
  },
];

export default function SweepPage() {
  const geometries = useGeometries();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const guest = isGuest(user);

  const [geometryId, setGeometryId] = useState('');
  const [baseName, setBaseName] = useState('');
  const [mode, setMode] = useState<CfdMode>('individual_part');
  const [presetKey, setPresetKey] = useState(PRESETS[0].key);
  const preset = PRESETS.find((p) => p.key === presetKey)!;
  const [values, setValues] = useState(PRESETS[0].defaults);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(
    () =>
      values
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map(Number)
        .filter((v) => !Number.isNaN(v)),
    [values],
  );

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ jobs: Job[] }>('/jobs/sweep', {
        geometry_id: geometryId,
        base_name: baseName,
        cfd_mode: mode,
        sweep_param: { path: preset.path, values: parsed },
        auto_submit: autoSubmit,
      });
      toast('ok', `${data.jobs.length} runs created${autoSubmit ? ' and submitted' : ' as drafts'}`);
      navigate('/runs');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const valid = geometryId && baseName.trim() && parsed.length >= 2 && parsed.length <= 20;

  return (
    <div className="settle mx-auto max-w-2xl">
      <PageHeader
        title="Parametric sweep"
        sub="One geometry, one knob, N runs — mesh-identical sweeps reuse the mesh automatically."
      />
      <Panel className="flex flex-col gap-5 p-6">
        <Field label="Base name">
          <Input value={baseName} onChange={(e) => setBaseName(e.target.value)} placeholder="e.g. RW v1.5 velocity sweep" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Geometry">
            <Select value={geometryId} onChange={(e) => setGeometryId(e.target.value)}>
              <option value="">Select…</option>
              {geometries.data?.items.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.component_name || g.original_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Profile">
            <Select value={mode} onChange={(e) => setMode(e.target.value as CfdMode)}>
              <option value="individual_part">Individual part</option>
              <option value="full_car">Full car</option>
            </Select>
          </Field>
        </div>
        <Field label="Swept parameter">
          <Select
            value={presetKey}
            onChange={(e) => {
              setPresetKey(e.target.value);
              setValues(PRESETS.find((p) => p.key === e.target.value)!.defaults);
            }}
          >
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} ({p.unit})
              </option>
            ))}
          </Select>
          {preset.note && <p className="mt-1.5 text-xs text-ink-3">{preset.note}</p>}
        </Field>
        <Field label={`Values (${preset.unit}, comma-separated, 2–20)`}>
          <Input value={values} onChange={(e) => setValues(e.target.value)} className="font-mono" />
        </Field>

        {/* Preview */}
        {parsed.length >= 2 && baseName.trim() && (
          <div>
            <p className="section-head mb-2">Grid preview</p>
            <div className="flex flex-col gap-1.5">
              {parsed.map((v, i) => (
                <div key={i} className="flex items-stretch border border-seam bg-ground/50">
                  <Stripe id={`${baseName}-${v}`} className="w-[10px]" />
                  <span className="font-mono tnum px-3 py-1.5 text-[13px]">
                    {baseName} — {preset.label} = {v} {preset.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoSubmit}
            onChange={(e) => setAutoSubmit(e.target.checked)}
            className="h-4 w-4 accent-[#1d43d8]"
          />
          Submit all runs immediately (unchecked saves drafts you can submit one by one)
        </label>

        {error && (
          <p role="alert" className="border border-crit/40 bg-crit-tint px-3 py-2 text-sm text-crit">
            {error}
          </p>
        )}

        <Button variant="primary" disabled={!valid || guest} busy={busy} onClick={submit}>
          {guest ? 'Guests are read-only' : `Create ${parsed.length || '…'} runs`}
        </Button>
      </Panel>
    </div>
  );
}
