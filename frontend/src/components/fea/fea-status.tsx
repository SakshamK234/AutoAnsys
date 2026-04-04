import { useState, useEffect } from 'react';
import { XCircle } from 'lucide-react';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { useCancelFeaJob, useFeaJobLog } from '@/hooks/use-fea';
import type { FEAJob } from '@/types/fea';

interface FeaStatusProps {
  job: FEAJob;
}

export function FeaStatus({ job }: FeaStatusProps) {
  const cancelJob = useCancelFeaJob();
  const { data: logText } = useFeaJobLog(
    job.status === 'running' || job.status === 'queued' ? job.id : undefined
  );
  const [elapsed, setElapsed] = useState(0);

  const isActive = job.status === 'pending' || job.status === 'queued' || job.status === 'running';

  useEffect(() => {
    if (!isActive) return;
    const start = new Date(job.created_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [job.created_at, isActive]);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <JobStatusBadge status={job.status} />
          {job.slurm_job_id && (
            <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
              SLURM #{job.slurm_job_id}
            </span>
          )}
        </div>
        {isActive && (
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

      {isActive && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[hsl(var(--muted-foreground))]">Elapsed:</span>
          <span className="font-mono font-medium">{formatElapsed(elapsed)}</span>
        </div>
      )}

      {logText && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
          <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
            <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Solver Log</p>
          </div>
          <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-auto max-h-64 text-[hsl(var(--foreground))]">
            {logText.split('\n').slice(-50).join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}
