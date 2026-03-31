import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResidualChart } from '@/components/jobs/residual-chart';
import { ForceChart } from '@/components/jobs/force-chart';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { useJob, useJobForces, useJobResiduals, useCancelJob } from '@/hooks/use-jobs';
import { cn, formatDate, formatFileSize } from '@/lib/utils';
import { ArrowLeft, XCircle, Download, FileIcon, FileText } from 'lucide-react';
import api from '@/lib/api';

interface ResultFile {
  id: string;
  job_id: string;
  filename: string;
  file_type: string;
  s3_key: string;
  file_size: number;
  created_at: string;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  forces_csv: 'Force Coefficients',
  residuals_csv: 'Residual History',
  case_data: 'Case Data',
  slurm_log: 'SLURM Log',
};

const tabs = ['Overview', 'Residuals', 'Forces', 'Files', 'Config'] as const;

export function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: job, isLoading } = useJob(id);
  const { data: forces } = useJobForces(id);
  const { data: residuals } = useJobResiduals(id);
  const cancelJob = useCancelJob();
  const [activeTab, setActiveTab] = useState<string>('Overview');

  const { data: files } = useQuery({
    queryKey: ['files', id],
    queryFn: async () => {
      const res = await api.get<ResultFile[]>(`/files/${id}`);
      return res.data;
    },
    enabled: !!id && job?.status === 'completed',
  });

  const handleDownloadFile = async (fileId: string) => {
    try {
      const res = await api.get<{ url: string; filename: string }>(`/files/${id}/download/${fileId}`);
      window.open(res.data.url, '_blank');
    } catch {
      // silently fail
    }
  };

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
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Job not found.</p>
        <button onClick={() => navigate('/jobs')} className="mt-2 text-sm font-medium text-[hsl(var(--primary))] hover:underline">
          Back to simulations
        </button>
      </div>
    );
  }

  const canCancel = job.status === 'queued' || job.status === 'running';

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/jobs')}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to simulations
      </button>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="font-mono text-xs text-[hsl(var(--muted-foreground))] mt-1">{job.id}</p>
        </div>
        {canCancel && (
          <button
            onClick={() => cancelJob.mutate(job.id)}
            disabled={cancelJob.isPending}
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel Job
          </button>
        )}
      </div>

      <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-md px-4 py-1.5 text-xs font-medium transition-all',
              activeTab === tab
                ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Status', value: job.status },
              { label: 'Created', value: formatDate(job.created_at) },
              job.submitted_at ? { label: 'Submitted', value: formatDate(job.submitted_at) } : null,
              job.started_at ? { label: 'Started', value: formatDate(job.started_at) } : null,
              job.completed_at ? { label: 'Completed', value: formatDate(job.completed_at) } : null,
              job.slurm_job_id ? { label: 'SLURM Job ID', value: job.slurm_job_id, mono: true } : null,
              { label: 'Geometry ID', value: job.geometry_id, mono: true },
            ].filter(Boolean).map((item, i) => (
              <div key={i} className="rounded-lg bg-[hsl(var(--background))] px-4 py-3">
                <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{item!.label}</p>
                <p className={cn('text-sm font-medium mt-1', (item as any).mono && 'font-mono text-xs')}>
                  {item!.value}
                </p>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'Residuals' && <ResidualChart data={residuals ?? []} />}
        {activeTab === 'Forces' && <ForceChart data={forces ?? []} />}
        {activeTab === 'Files' && (
          <div>
            {job.status !== 'completed' ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileIcon className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-3" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Result files will be available once the job completes.
                </p>
              </div>
            ) : !files || files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileIcon className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-3" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No result files found.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-4 rounded-lg bg-[hsl(var(--background))] px-4 py-3 transition-colors hover:bg-[hsl(var(--muted))]"
                  >
                    <div className="rounded-lg bg-[hsl(var(--primary)/0.1)] p-2">
                      <FileText className="h-4 w-4 text-[hsl(var(--primary))]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.filename}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {FILE_TYPE_LABELS[f.file_type] || f.file_type} &middot; {formatFileSize(f.file_size)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownloadFile(f.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--accent))] transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'Config' && (
          <pre className="rounded-lg bg-[hsl(var(--background))] p-4 text-xs overflow-auto max-h-[600px] font-mono">
            {JSON.stringify(job.config, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
