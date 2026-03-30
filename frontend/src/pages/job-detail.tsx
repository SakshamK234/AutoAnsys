import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { ResidualChart } from '@/components/jobs/residual-chart';
import { ForceChart } from '@/components/jobs/force-chart';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { useJob, useJobForces, useJobResiduals, useCancelJob } from '@/hooks/use-jobs';
import { cn, formatDate } from '@/lib/utils';

const tabs = ['Overview', 'Residuals', 'Forces', 'Files', 'Config'] as const;

export function JobDetailPage() {
  const { id } = useParams();
  const { data: job, isLoading } = useJob(id);
  const { data: forces } = useJobForces(id);
  const { data: residuals } = useJobResiduals(id);
  const cancelJob = useCancelJob();
  const [activeTab, setActiveTab] = useState<string>('Overview');

  if (isLoading) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading job...</p>;
  }

  if (!job) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Job not found.</p>;
  }

  const canCancel = job.status === 'queued' || job.status === 'running';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{job.name}</h1>
          <p className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{job.id}</p>
        </div>
        <div className="flex items-center gap-3">
          {canCancel && (
            <button
              onClick={() => cancelJob.mutate(job.id)}
              disabled={cancelJob.isPending}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Cancel Job
            </button>
          )}
          <JobStatusBadge status={job.status} />
        </div>
      </div>

      <div className="flex gap-1 border-b border-[hsl(var(--border))]">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-foreground'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-[hsl(var(--muted-foreground))]">Status:</span> <span className="font-medium">{job.status}</span></div>
            <div><span className="text-[hsl(var(--muted-foreground))]">Created:</span> <span className="font-medium">{formatDate(job.created_at)}</span></div>
            {job.submitted_at && <div><span className="text-[hsl(var(--muted-foreground))]">Submitted:</span> <span className="font-medium">{formatDate(job.submitted_at)}</span></div>}
            {job.started_at && <div><span className="text-[hsl(var(--muted-foreground))]">Started:</span> <span className="font-medium">{formatDate(job.started_at)}</span></div>}
            {job.completed_at && <div><span className="text-[hsl(var(--muted-foreground))]">Completed:</span> <span className="font-medium">{formatDate(job.completed_at)}</span></div>}
            {job.slurm_job_id && <div><span className="text-[hsl(var(--muted-foreground))]">SLURM Job ID:</span> <span className="font-mono font-medium">{job.slurm_job_id}</span></div>}
            <div><span className="text-[hsl(var(--muted-foreground))]">Geometry ID:</span> <span className="font-mono font-medium text-xs">{job.geometry_id}</span></div>
          </div>
        )}
        {activeTab === 'Residuals' && <ResidualChart data={residuals ?? []} />}
        {activeTab === 'Forces' && <ForceChart data={forces ?? []} />}
        {activeTab === 'Files' && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            File browser coming soon.
          </p>
        )}
        {activeTab === 'Config' && (
          <pre className="rounded-md bg-[hsl(var(--muted))] p-4 text-xs overflow-auto max-h-[600px]">
            {JSON.stringify(job.config, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
