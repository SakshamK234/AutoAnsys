import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useJobs } from '@/hooks/use-jobs';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { cn, formatDate } from '@/lib/utils';
import { GitCompareArrows, Plus, X, BarChart3, TrendingDown } from 'lucide-react';
import api from '@/lib/api';
import type { Job, ForceReport, ResidualData } from '@/types';

const JOB_COLORS = ['#f97316', '#06b6d4', '#22c55e', '#a78bfa', '#fb7185', '#eab308'];

interface CompareData {
  job: Job;
  forces: ForceReport[];
  residuals: ResidualData[];
}

function JobSelector({
  selectedIds,
  onAdd,
  onRemove,
}: {
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { data } = useJobs({ status: 'completed', limit: 50 });
  const jobs = data?.items ?? [];
  const available = jobs.filter((j) => !selectedIds.includes(j.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {selectedIds.map((id, idx) => {
          const job = jobs.find((j) => j.id === id);
          return (
            <div
              key={id}
              className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5"
            >
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: JOB_COLORS[idx] }} />
              <span className="text-sm font-medium">{job?.name || id.slice(0, 8)}</span>
              <button onClick={() => onRemove(id)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
      {selectedIds.length < 6 && available.length > 0 && (
        <select
          onChange={(e) => {
            if (e.target.value) {
              onAdd(e.target.value);
              e.target.value = '';
            }
          }}
          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          defaultValue=""
        >
          <option value="" disabled>
            + Add a completed job to compare...
          </option>
          {available.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name} — {formatDate(j.completed_at || j.created_at)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function ForceComparisonChart({ data }: { data: CompareData[] }) {
  // Build merged dataset: for each job, show Cd over iterations
  // We'll show Cd, Cl, Cm as separate sub-charts
  const metrics = [
    { key: 'cd', label: 'Drag Coefficient (Cd)' },
    { key: 'cl', label: 'Lift Coefficient (Cl)' },
    { key: 'cm', label: 'Moment Coefficient (Cm)' },
  ] as const;

  return (
    <div className="space-y-6">
      {metrics.map((metric) => {
        // Build merged data keyed by iteration
        const iterMap = new Map<number, Record<string, number>>();
        data.forEach((d, idx) => {
          d.forces.forEach((f) => {
            const existing = iterMap.get(f.iteration) || { iteration: f.iteration };
            existing[`job_${idx}`] = f[metric.key];
            iterMap.set(f.iteration, existing);
          });
        });
        const chartData = Array.from(iterMap.values()).sort((a, b) => a.iteration - b.iteration);

        return (
          <div key={metric.key}>
            <h4 className="text-sm font-semibold mb-2">{metric.label}</h4>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="iteration" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  {data.map((d, idx) => (
                    <Line
                      key={idx}
                      type="monotone"
                      dataKey={`job_${idx}`}
                      name={d.job.name}
                      stroke={JOB_COLORS[idx]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResidualComparisonChart({ data }: { data: CompareData[] }) {
  // Show continuity residual for each job
  const iterMap = new Map<number, Record<string, number>>();
  data.forEach((d, idx) => {
    d.residuals.forEach((r) => {
      const existing = iterMap.get(r.iteration) || { iteration: r.iteration };
      existing[`job_${idx}`] = r.continuity;
      iterMap.set(r.iteration, existing);
    });
  });
  const chartData = Array.from(iterMap.values()).sort((a, b) => a.iteration - b.iteration);

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Continuity Residual Convergence</h4>
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="iteration" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis scale="log" domain={['auto', 'auto']} stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend />
            {data.map((d, idx) => (
              <Line
                key={idx}
                type="monotone"
                dataKey={`job_${idx}`}
                name={d.job.name}
                stroke={JOB_COLORS[idx]}
                dot={false}
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ConfigComparison({ data }: { data: CompareData[] }) {
  if (data.length < 2) return null;

  const configKeys = [
    { path: ['mesh', 'surface_mesh', 'min_size'], label: 'Surface Min Size' },
    { path: ['mesh', 'surface_mesh', 'max_size'], label: 'Surface Max Size' },
    { path: ['mesh', 'volume_mesh', 'max_cell_length'], label: 'Volume Max Cell' },
    { path: ['mesh', 'boundary_layers', 'num_layers'], label: 'BL Layers' },
    { path: ['mesh', 'boundary_layers', 'first_layer_height'], label: 'BL First Height' },
    { path: ['solver', 'turbulence', 'model'], label: 'Turbulence Model' },
    { path: ['solver', 'boundary_conditions', 'inlet', 'velocity'], label: 'Inlet Velocity' },
    { path: ['solver', 'solution_methods', 'scheme'], label: 'Solver Scheme' },
    { path: ['solver', 'convergence', 'max_iterations'], label: 'Max Iterations' },
    { path: ['solver', 'convergence', 'residual_target'], label: 'Residual Target' },
    { path: ['slurm', 'nodes'], label: 'Nodes' },
    { path: ['slurm', 'cores_per_node'], label: 'Cores/Node' },
  ];

  function getNestedValue(obj: any, path: string[]): string {
    let val = obj;
    for (const key of path) {
      if (val == null) return '—';
      val = val[key];
    }
    if (val == null) return '—';
    if (typeof val === 'number' && val < 0.01) return val.toExponential(1);
    return String(val);
  }

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">Configuration Comparison</h4>
      <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Parameter
              </th>
              {data.map((d, idx) => (
                <th key={idx} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: JOB_COLORS[idx] }} />
                    <span className="truncate max-w-[120px]">{d.job.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {configKeys.map((ck) => {
              const values = data.map((d) => getNestedValue(d.job.config, ck.path));
              const allSame = values.every((v) => v === values[0]);
              return (
                <tr key={ck.label} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="px-4 py-2 text-[hsl(var(--muted-foreground))] font-medium">{ck.label}</td>
                  {values.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        'px-4 py-2 font-mono text-xs',
                        !allSame && 'font-semibold text-[hsl(var(--primary))]'
                      )}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinalValuesSummary({ data }: { data: CompareData[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">Final Force Coefficients</h4>
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {data.map((d, idx) => {
          const lastForce = d.forces.length > 0 ? d.forces[d.forces.length - 1] : null;
          return (
            <div
              key={idx}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: JOB_COLORS[idx] }} />
                <span className="text-sm font-semibold truncate">{d.job.name}</span>
              </div>
              {lastForce ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {(['cd', 'cl', 'cm'] as const).map((k) => (
                    <div key={k}>
                      <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase">{k}</p>
                      <p className="text-lg font-bold font-mono">{lastForce[k].toFixed(4)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No force data</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ComparePage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'forces' | 'residuals' | 'config'>('forces');

  const { data: compareData, isLoading } = useQuery({
    queryKey: ['compare', selectedIds],
    queryFn: async () => {
      const res = await api.get<CompareData[]>(`/jobs/compare/data?ids=${selectedIds.join(',')}`);
      return res.data;
    },
    enabled: selectedIds.length >= 2,
  });

  const handleAdd = (id: string) => setSelectedIds((prev) => [...prev, id]);
  const handleRemove = (id: string) => setSelectedIds((prev) => prev.filter((x) => x !== id));

  const tabs = [
    { key: 'forces' as const, label: 'Forces', icon: BarChart3 },
    { key: 'residuals' as const, label: 'Residuals', icon: TrendingDown },
    { key: 'config' as const, label: 'Config Diff', icon: GitCompareArrows },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compare Simulations</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Select 2-6 completed jobs to compare side-by-side
        </p>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <JobSelector selectedIds={selectedIds} onAdd={handleAdd} onRemove={handleRemove} />
      </div>

      {selectedIds.length < 2 && (
        <div className="rounded-xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="rounded-2xl bg-[hsl(var(--primary)/0.1)] p-5 mb-4">
              <GitCompareArrows className="h-10 w-10 text-[hsl(var(--primary))]" />
            </div>
            <p className="text-lg font-semibold">Select at least 2 jobs</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Choose completed simulations from the dropdown above
            </p>
          </div>
        </div>
      )}

      {selectedIds.length >= 2 && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
            </div>
          ) : compareData && compareData.length >= 2 ? (
            <>
              <FinalValuesSummary data={compareData} />

              <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1 w-fit">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium transition-all',
                      activeTab === tab.key
                        ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
                {activeTab === 'forces' && <ForceComparisonChart data={compareData} />}
                {activeTab === 'residuals' && <ResidualComparisonChart data={compareData} />}
                {activeTab === 'config' && <ConfigComparison data={compareData} />}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-sm text-[hsl(var(--muted-foreground))]">
              Could not load comparison data. Make sure the selected jobs are accessible to you.
            </div>
          )}
        </>
      )}
    </div>
  );
}
