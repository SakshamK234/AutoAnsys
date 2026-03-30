import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JobTable } from '@/components/jobs/job-table';
import { Plus } from 'lucide-react';

const FILTERS = ['all', 'queued', 'running', 'completed', 'failed'] as const;

export function JobsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Simulations</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            View and manage your CFD simulations
          </p>
        </div>
        <button
          onClick={() => navigate('/new-job')}
          className="flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Simulation
        </button>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              statusFilter === s
                ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <JobTable jobs={[]} />
    </div>
  );
}
