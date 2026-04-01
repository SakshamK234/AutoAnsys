import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JobTable } from '@/components/jobs/job-table';
import { Plus, Filter } from 'lucide-react';

const FILTERS = ['all', 'queued', 'running', 'completed', 'failed'] as const;

export function JobsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulations</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            View and manage your CFD simulations
          </p>
        </div>
        <button
          onClick={() => navigate('/new-job')}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 active:brightness-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          New Simulation
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
          {FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                statusFilter === s
                  ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <JobTable jobs={[]} />
    </div>
  );
}
