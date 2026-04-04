import { useNavigate } from 'react-router-dom';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { formatDate } from '@/lib/utils';
import { MATERIAL_PRESETS, type MaterialPresetKey } from '@/lib/fea-constants';
import { Wrench, ArrowRight, Plus } from 'lucide-react';
import type { FEAJob } from '@/types/fea';

interface FeaRecentJobsProps {
  jobs: FEAJob[];
  loading?: boolean;
}

export function FeaRecentJobs({ jobs, loading }: FeaRecentJobsProps) {
  const navigate = useNavigate();

  const getMaterialLabel = (job: FEAJob): string => {
    const preset = (job.material_json as Record<string, unknown> | null)?.preset as string | undefined;
    if (preset && preset !== 'custom' && preset in MATERIAL_PRESETS) {
      return MATERIAL_PRESETS[preset as MaterialPresetKey].label;
    }
    return preset || 'Custom';
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
        <h3 className="text-sm font-semibold">Recent FEA Jobs</h3>
        {jobs.length > 0 && (
          <button
            onClick={() => navigate('/fea/jobs')}
            className="flex items-center gap-1 text-xs font-medium text-[hsl(var(--primary))] hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="p-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-[hsl(var(--muted))] p-3 mb-3">
              <Wrench className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            </div>
            <p className="text-sm font-medium">No FEA jobs yet</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-[200px]">
              Run your first structural analysis to see it here
            </p>
            <button
              onClick={() => navigate('/fea/new')}
              className="mt-3 flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 transition-all"
            >
              <Plus className="h-3 w-3" />
              Run your first analysis
            </button>
          </div>
        ) : (
          <div>
            {jobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                onClick={() => navigate(`/fea/jobs/${job.id}`)}
                className="group flex items-center gap-4 rounded-lg px-3 py-3 cursor-pointer transition-colors hover:bg-[hsl(var(--muted))]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{job.job_name}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                    {getMaterialLabel(job)} · {formatDate(job.created_at)}
                  </p>
                </div>
                <JobStatusBadge status={job.status} />
                <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
