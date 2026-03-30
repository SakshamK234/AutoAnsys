import { useNavigate } from 'react-router-dom';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { formatDate } from '@/lib/utils';
import type { Job } from '@/types';

interface RecentJobsProps {
  jobs: Job[];
  loading?: boolean;
}

export function RecentJobs({ jobs, loading }: RecentJobsProps) {
  const navigate = useNavigate();

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <h3 className="mb-4 font-semibold">Recent Simulations</h3>
      {loading ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading...</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No simulations yet. Start your first one!</p>
      ) : (
        <div className="space-y-3">
          {jobs.slice(0, 5).map((job) => (
            <div
              key={job.id}
              onClick={() => navigate(`/jobs/${job.id}`)}
              className="flex items-center justify-between rounded-md p-3 cursor-pointer transition-colors hover:bg-[hsl(var(--muted))]"
            >
              <div>
                <p className="font-medium text-sm">{job.name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(job.created_at)}</p>
              </div>
              <JobStatusBadge status={job.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
