import { MATERIAL_PRESETS, CONSTRAINT_LABELS, LOAD_LABELS, type MaterialPresetKey } from '@/lib/fea-constants';
import type { FEAMaterial, FEAConstraint, FEALoad } from '@/types/fea';

interface ReviewStepProps {
  meshFileName: string | null;
  material: FEAMaterial;
  constraints: FEAConstraint[];
  loads: FEALoad[];
  jobName: string;
  onJobNameChange: (name: string) => void;
  error: string | null;
  submitting: boolean;
}

function formatGpa(pa: number): string {
  return (pa / 1e9).toFixed(1);
}

function formatMpa(pa: number): string {
  return (pa / 1e6).toFixed(0);
}

function constraintSummary(c: Omit<FEAConstraint, 'id'>): string {
  const label = CONSTRAINT_LABELS[c.type] || c.type;
  const faces = c.face_ids.join(', ') || 'none';
  let extra = '';
  if (c.type === 'roller' && c.axis) extra = ` (${c.axis} axis)`;
  if (c.type === 'symmetry' && c.plane) extra = ` (${c.plane} plane)`;
  if (c.type === 'displacement' && c.displacement) {
    const axes = (['x', 'y', 'z'] as const)
      .map((a) => c.displacement![a] !== null ? `${a.toUpperCase()}=${(c.displacement![a]! * 1000).toFixed(3)} mm` : `${a.toUpperCase()}=free`)
      .join(', ');
    extra = ` (${axes})`;
  }
  return `${label} — ${faces}${extra}`;
}

function loadSummary(l: Omit<FEALoad, 'id'>): string {
  const label = LOAD_LABELS[l.type] || l.type;
  const faces = l.face_ids?.join(', ');

  if (l.type === 'force') {
    const dir = l.direction ? `(${l.direction.x}, ${l.direction.y}, ${l.direction.z})` : '';
    return `${label} — ${faces || 'none'} — ${l.magnitude ?? 0} N — direction ${dir}`;
  }
  if (l.type === 'pressure') {
    return `${label} — ${faces || 'none'} — ${l.magnitude ?? 0} Pa`;
  }
  if (l.type === 'gravity') {
    const dir = l.direction ? `(${l.direction.x}, ${l.direction.y}, ${l.direction.z})` : '(0, -1, 0)';
    return `${label} — g=${l.g ?? 9.81} m/s² — direction ${dir}`;
  }
  if (l.type === 'displacement' && l.displacement) {
    const axes = (['x', 'y', 'z'] as const)
      .map((a) => l.displacement![a] !== null ? `${a.toUpperCase()}=${(l.displacement![a]! * 1000).toFixed(3)} mm` : `${a.toUpperCase()}=free`)
      .join(', ');
    return `${label} — ${faces || 'none'} — (${axes})`;
  }
  return label;
}

export function ReviewStep({
  meshFileName,
  material,
  constraints,
  loads,
  jobName,
  onJobNameChange,
  error,
  submitting,
}: ReviewStepProps) {
  const presetLabel = material.preset !== 'custom' && material.preset in MATERIAL_PRESETS
    ? MATERIAL_PRESETS[material.preset as MaterialPresetKey].label
    : 'Custom';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Review & Submit</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Verify your configuration before submitting to the cluster.
        </p>
      </div>

      <div className="space-y-4">
        {/* Mesh */}
        <div className="rounded-lg bg-[hsl(var(--background))] px-4 py-3">
          <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Mesh File
          </p>
          <p className="text-sm font-medium mt-1 font-mono">{meshFileName || '—'}</p>
        </div>

        {/* Material */}
        <div className="rounded-lg bg-[hsl(var(--background))] px-4 py-3">
          <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Material
          </p>
          <p className="text-sm font-semibold mt-1">{presetLabel}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
            <span>Young's Modulus: <span className="text-[hsl(var(--foreground))] font-medium">{formatGpa(material.youngs_modulus)} GPa</span></span>
            <span>Poisson's Ratio: <span className="text-[hsl(var(--foreground))] font-medium">{material.poissons_ratio}</span></span>
            <span>Density: <span className="text-[hsl(var(--foreground))] font-medium">{material.density} kg/m³</span></span>
            <span>Yield Strength: <span className="text-[hsl(var(--foreground))] font-medium">{material.yield_strength ? `${formatMpa(material.yield_strength)} MPa` : '—'}</span></span>
          </div>
        </div>

        {/* Constraints */}
        <div className="rounded-lg bg-[hsl(var(--background))] px-4 py-3">
          <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Constraints ({constraints.length})
          </p>
          <ul className="mt-2 space-y-1">
            {constraints.map((c) => (
              <li key={c.id} className="text-xs flex items-start gap-1.5">
                <span className="text-[hsl(var(--primary))] mt-0.5">•</span>
                <span>{constraintSummary(c)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Loads */}
        <div className="rounded-lg bg-[hsl(var(--background))] px-4 py-3">
          <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Loads ({loads.length})
          </p>
          <ul className="mt-2 space-y-1">
            {loads.map((l) => (
              <li key={l.id} className="text-xs flex items-start gap-1.5">
                <span className="text-[hsl(var(--primary))] mt-0.5">•</span>
                <span>{loadSummary(l)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Job Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Job Name</label>
        <input
          type="text"
          value={jobName}
          onChange={(e) => onJobNameChange(e.target.value)}
          placeholder="e.g., bracket_static_001"
          className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
        />
        {!jobName.trim() && (
          <p className="text-xs text-rose-500 mt-1">Job name is required to submit.</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-500">
          {error}
        </div>
      )}

      {submitting && (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
          Submitting to cluster…
        </div>
      )}
    </div>
  );
}
