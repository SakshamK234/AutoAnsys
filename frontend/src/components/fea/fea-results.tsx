import { Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { FEAJob } from '@/types/fea';

interface FeaResultsProps {
  job: FEAJob;
}

function MetricCard({ label, value, unit, accent }: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${accent || ''}`}>
        {value}
        {unit && <span className="text-sm font-normal text-[hsl(var(--muted-foreground))] ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export function FeaResults({ job }: FeaResultsProps) {
  const s = job.summary_json;

  if (!s) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No results available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Max Displacement"
          value={s.max_displacement_mm.toFixed(3)}
          unit="mm"
        />
        <MetricCard
          label="Max Von Mises Stress"
          value={s.max_von_mises_stress_mpa.toFixed(1)}
          unit="MPa"
        />
        <MetricCard
          label="Safety Factor"
          value={s.safety_factor !== null ? s.safety_factor.toFixed(2) : 'N/A'}
          accent={
            s.safety_factor !== null
              ? s.safety_factor >= 1.5
                ? 'text-emerald-500'
                : s.safety_factor >= 1.0
                ? 'text-amber-500'
                : 'text-rose-500'
              : ''
          }
        />
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Yielded?
          </p>
          <div className="mt-2">
            {s.yielded === null ? (
              <span className="text-sm text-[hsl(var(--muted-foreground))]">N/A</span>
            ) : s.yielded ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                <AlertTriangle className="h-3 w-3" />
                Yes
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                No
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h4 className="text-sm font-semibold mb-4">Detailed Results</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg bg-[hsl(var(--background))] px-4 py-3">
            <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Max Principal Stress
            </p>
            <p className="text-sm font-medium mt-1 font-mono">
              {s.max_principal_stress_mpa.toFixed(2)} MPa
            </p>
          </div>
          <div className="rounded-lg bg-[hsl(var(--background))] px-4 py-3">
            <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Min Principal Stress
            </p>
            <p className="text-sm font-medium mt-1 font-mono">
              {s.min_principal_stress_mpa.toFixed(2)} MPa
            </p>
          </div>
          <div className="rounded-lg bg-[hsl(var(--background))] px-4 py-3">
            <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Max Reaction Force
            </p>
            <p className="text-sm font-medium mt-1 font-mono">
              {s.max_reaction_force_n.toFixed(1)} N
            </p>
          </div>
        </div>
      </div>

      {job.output_files_json && job.output_files_json.length > 0 && (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
          <h4 className="text-sm font-semibold mb-3">Downloads</h4>
          <div className="flex flex-wrap gap-2">
            {job.output_files_json.map((f) => (
              <a
                key={f.name}
                href={f.url}
                className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-medium hover:bg-[hsl(var(--accent))] transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                {f.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
