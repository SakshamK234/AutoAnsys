import { useNavigate } from 'react-router-dom';
import { Plus, Wrench } from 'lucide-react';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { useFeaJobs } from '@/hooks/use-fea';
import { formatDate } from '@/lib/utils';

export function FeaJobsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useFeaJobs();

  const jobs = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">FEA Jobs</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            View and manage your structural analysis jobs
          </p>
        </div>
        <button
          onClick={() => navigate('/fea/new')}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 active:brightness-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          New FEA Analysis
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <div className="rounded-xl bg-[hsl(var(--primary)/0.1)] p-4 mb-4">
            <Wrench className="h-8 w-8 text-[hsl(var(--primary))]" />
          </div>
          <p className="text-sm font-medium">No FEA jobs yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Create your first structural analysis to get started.
          </p>
          <button
            onClick={() => navigate('/fea/new')}
            className="mt-4 flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            New FEA Analysis
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Job Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Mesh File
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                  Material
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => navigate(`/fea/jobs/${job.id}`)}
                  className="border-b border-[hsl(var(--border))] last:border-0 cursor-pointer hover:bg-[hsl(var(--accent)/0.5)] transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{job.job_name}</td>
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {formatDate(job.created_at)}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] font-mono text-xs truncate max-w-[200px]">
                    {job.mesh_file_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] capitalize">
                    {(job.material_json as any)?.preset || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
