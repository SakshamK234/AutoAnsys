import { useNavigate } from 'react-router-dom';
import { formatDate } from '@/lib/utils';
import { JobStatusBadge } from './job-status-badge';
import { Clock, ArrowRight } from 'lucide-react';
import type { Job } from '@/types';

interface JobTableProps {
  jobs: Job[];
  loading?: boolean;
  showOwner?: boolean;
}

export function JobTable({ jobs, loading, showOwner }: JobTableProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="rounded-2xl bg-[hsl(var(--primary)/0.1)] p-5 mb-5">
            <Clock className="h-10 w-10 text-[hsl(var(--primary))]" />
          </div>
          <p className="text-lg font-semibold">No simulations yet</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xs text-center">
            Create your first simulation to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border))]">
            <th className="px-5 py-3 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Name</th>
            {showOwner && (
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Owner</th>
            )}
            <th className="px-5 py-3 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Status</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Created</th>
            <th className="px-5 py-3 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">SLURM ID</th>
            <th className="px-5 py-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              onClick={() => navigate(`/jobs/${job.id}`)}
              className="group cursor-pointer border-b border-[hsl(var(--border))] last:border-0 transition-colors hover:bg-[hsl(var(--muted))]"
            >
              <td className="px-5 py-3.5 font-medium">
                {job.name}
                {job.group_name && !showOwner && (
                  <span className="ml-2 text-[10px] font-normal text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded px-1.5 py-0.5">
                    {job.group_name}
                  </span>
                )}
              </td>
              {showOwner && (
                <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">
                  {job.owner_name || '—'}
                </td>
              )}
              <td className="px-5 py-3.5">
                <JobStatusBadge status={job.status} />
              </td>
              <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">
                {formatDate(job.created_at)}
              </td>
              <td className="px-5 py-3.5 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                {job.slurm_job_id || '—'}
              </td>
              <td className="px-5 py-3.5">
                <ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 transition-opacity" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
