import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { JobTable } from '@/components/jobs/job-table';
import { useJobs } from '@/hooks/use-jobs';
import { useGroups } from '@/hooks/use-groups';
import { Plus, Filter, Search, X, Users, User } from 'lucide-react';

const FILTERS = ['all', 'queued', 'running', 'completed', 'failed'] as const;

type ViewMode = 'mine' | 'group';

export function JobsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const searchFromUrl = searchParams.get('search') || '';
  const [searchInput, setSearchInput] = useState(searchFromUrl);

  const { data: groups } = useGroups();
  const hasGroups = groups && groups.length > 0;

  const { data, isLoading } = useJobs({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: searchFromUrl || undefined,
    group_id: viewMode === 'group' && selectedGroupId ? selectedGroupId : undefined,
  });

  const handleSearchSubmit = () => {
    if (searchInput.trim()) {
      setSearchParams({ search: searchInput.trim() });
    } else {
      setSearchParams({});
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const handleViewModeSwitch = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'group' && !selectedGroupId && groups?.length) {
      setSelectedGroupId(groups[0].id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulations</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {viewMode === 'group' ? 'Viewing group simulations' : 'View and manage your CFD simulations'}
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

      {/* View toggle: Mine vs Group */}
      {hasGroups && (
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
            <button
              onClick={() => handleViewModeSwitch('mine')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === 'mine'
                  ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <User className="h-3 w-3" /> My Sims
            </button>
            <button
              onClick={() => handleViewModeSwitch('group')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === 'group'
                  ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              <Users className="h-3 w-3" /> Group
            </button>
          </div>

          {viewMode === 'group' && groups && (
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] transition-shadow"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.member_count})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
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

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
            placeholder="Search by name..."
            className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] pl-9 pr-8 py-1.5 text-xs placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] transition-shadow"
          />
          {searchFromUrl && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {searchFromUrl && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Showing results for "<span className="font-medium text-[hsl(var(--foreground))]">{searchFromUrl}</span>"
        </p>
      )}

      <JobTable
        jobs={data?.items ?? []}
        loading={isLoading}
        showOwner={viewMode === 'group'}
      />
    </div>
  );
}
