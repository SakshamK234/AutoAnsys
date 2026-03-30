import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/lib/utils';
import { JobStatusBadge } from './job-status-badge';
import type { Job } from '@/types';

interface JobTableProps {
  jobs: Job[];
  loading?: boolean;
}

export function JobTable({ jobs, loading }: JobTableProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
        Loading jobs...
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
        <p className="text-lg font-medium">No simulations yet</p>
        <p className="text-sm">Create your first simulation to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
            <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Name</th>
            <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Status</th>
            <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">Created</th>
            <th className="px-4 py-3 text-left font-medium text-[hsl(var(--muted-foreground))]">SLURM ID</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              onClick={() => navigate(`/jobs/${job.id}`)}
              className="cursor-pointer border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--muted))]"
            >
              <td className="px-4 py-3 font-medium">{job.name}</td>
              <td className="px-4 py-3">
                <JobStatusBadge status={job.status} />
              </td>
              <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                {formatDate(job.created_at)}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                {job.slurm_job_id || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
