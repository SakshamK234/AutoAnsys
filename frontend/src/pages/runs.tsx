import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useGroups, useJobs } from '../lib/queries';
import { useAuth, isGuest } from '../stores/auth';
import { PageHeader } from '../components/chrome';
import { Button, EmptyState, Input, Loading, Select } from '../components/ui';
import { RunRow } from '../components/run-rows';

const STATUS_FILTERS = ['all', 'running', 'queued', 'completed', 'failed', 'cancelled', 'draft'] as const;
const PAGE_SIZE = 25;

export default function RunsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const view = (params.get('view') as 'mine' | 'group') ?? 'mine';
  const groupId = params.get('group') ?? '';
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [page, setPage] = useState(0);
  const { user } = useAuth();
  const groups = useGroups();

  const filters = useMemo(
    () => ({
      status,
      search: search || undefined,
      view,
      group_id: groupId || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [status, search, view, groupId, page],
  );
  const jobs = useJobs(filters);
  const total = jobs.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setParam(key: string, value: string) {
    setPage(0);
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );
  }

  return (
    <div className="settle">
      <PageHeader
        title="Runs"
        sub={`${total} run${total === 1 ? '' : 's'}`}
        actions={
          !isGuest(user) && (
            <Link to="/runs/new">
              <Button variant="primary">
                <Plus size={14} strokeWidth={3} /> New run
              </Button>
            </Link>
          )
        }
      />

      {/* Filter strip */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setParam('status', s === 'all' ? '' : s)}
              className={`font-condensed cursor-pointer rounded-[3px] border px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] uppercase transition-colors ${
                status === s
                  ? 'border-ink bg-ink text-white'
                  : 'border-seam-strong bg-paper text-ink-2 hover:border-ink-3'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={view === 'group' && groupId ? groupId : 'mine'}
            onChange={(e) => {
              const v = e.target.value;
              setParams(
                (p) => {
                  if (v === 'mine') {
                    p.delete('view');
                    p.delete('group');
                  } else {
                    p.set('view', 'group');
                    p.set('group', v);
                  }
                  return p;
                },
                { replace: true },
              );
              setPage(0);
            }}
            className="w-44"
            aria-label="Scope"
          >
            <option value="mine">My runs</option>
            {groups.data?.map((g) => (
              <option key={g.id} value={g.id}>
                Team: {g.name}
              </option>
            ))}
          </Select>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search runs…"
              className="w-52 pl-8"
              aria-label="Search runs"
            />
          </div>
        </div>
      </div>

      {jobs.isLoading ? (
        <Loading label="Loading runs" />
      ) : jobs.data?.items.length ? (
        <>
          <div className="flex flex-col gap-2">
            {jobs.data.items.map((j) => (
              <RunRow key={j.id} job={j} showOwner={view === 'group'} />
            ))}
          </div>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                ← Prev
              </Button>
              <span className="font-mono tnum text-xs text-ink-2">
                {page + 1} / {pages}
              </span>
              <Button variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Next →
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="No runs match"
          detail={
            status !== 'all' || search
              ? 'Try clearing the filters.'
              : 'Start your first run from a geometry upload.'
          }
        />
      )}
    </div>
  );
}
