import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useFeaJob } from '@/hooks/use-fea';
import { FeaStatus } from '@/components/fea/fea-status';
import { FeaResults } from '@/components/fea/fea-results';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { MATERIAL_PRESETS, type MaterialPresetKey } from '@/lib/fea-constants';

const tabs = ['Overview', 'Results', 'Files', 'Config'] as const;

export function FeaJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: job, isLoading } = useFeaJob(id);
  const [activeTab, setActiveTab] = useState<string>('Overview');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">FEA job not found.</p>
        <button
          onClick={() => navigate('/fea/jobs')}
          className="mt-2 text-sm font-medium text-[hsl(var(--primary))] hover:underline"
        >
          Back to FEA jobs
        </button>
      </div>
    );
  }

  const materialPreset = (job.material_json as any)?.preset as string | undefined;
  const materialLabel = materialPreset && materialPreset in MATERIAL_PRESETS
    ? MATERIAL_PRESETS[materialPreset as MaterialPresetKey].label
    : materialPreset || 'Custom';

  const isCompleted = job.status === 'completed';

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/fea/jobs')}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to FEA jobs
      </button>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{job.job_name}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="font-mono text-xs text-[hsl(var(--muted-foreground))] mt-1">{job.id}</p>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            disabled={tab === 'Results' && !isCompleted}
            className={cn(
              'rounded-md px-4 py-1.5 text-xs font-medium transition-all',
              activeTab === tab
                ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              tab === 'Results' && !isCompleted && 'opacity-40 cursor-not-allowed'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            <FeaStatus job={job} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Status', value: job.status },
                { label: 'Created', value: formatDate(job.created_at) },
                job.slurm_job_id ? { label: 'SLURM Job ID', value: job.slurm_job_id, mono: true } : null,
                { label: 'Material', value: materialLabel },
                job.mesh_file_name ? { label: 'Mesh File', value: job.mesh_file_name, mono: true } : null,
              ].filter(Boolean).map((item, i) => (
                <div key={i} className="rounded-lg bg-[hsl(var(--background))] px-4 py-3">
                  <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                    {item!.label}
                  </p>
                  <p className={cn('text-sm font-medium mt-1', (item as any).mono && 'font-mono text-xs')}>
                    {item!.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Results' && <FeaResults job={job} />}

        {activeTab === 'Files' && (
          <div>
            {job.output_files_json && job.output_files_json.length > 0 ? (
              <div className="space-y-2">
                {job.output_files_json.map((f) => (
                  <a
                    key={f.name}
                    href={f.url}
                    className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-4 py-3 hover:bg-[hsl(var(--accent))] transition-colors"
                  >
                    <Download className="h-4 w-4 text-[hsl(var(--primary))]" />
                    <span className="text-sm font-medium">{f.name}</span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {isCompleted ? 'No output files available.' : 'Files will be available after the job completes.'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Config' && (
          <pre className="rounded-lg bg-[hsl(var(--background))] p-4 text-xs overflow-auto max-h-[600px] font-mono">
            {JSON.stringify(
              {
                material: job.material_json,
                constraints: job.constraints_json,
                loads: job.loads_json,
                arc: job.arc_settings_json,
              },
              null,
              2
            )}
          </pre>
        )}
      </div>
    </div>
  );
}
