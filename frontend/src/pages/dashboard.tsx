import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useClusterStatus, useJobs } from '../lib/queries';
import { useAuth, isGuest } from '../stores/auth';
import { PageHeader } from '../components/chrome';
import { Button, EmptyState, Loading } from '../components/ui';
import { Stripe, Roundel, StatusChip } from '../components/livery';
import { RunRow } from '../components/run-rows';
import { formatAgo, formatCoeff } from '../lib/format';
import { clsx } from 'clsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const guest = isGuest(user);
  // Status counts come from per-status totals, not a page slice.
  const all = useJobs({ limit: 1 });
  const running = useJobs({ status: 'running', limit: 10 });
  const queued = useJobs({ status: 'queued', limit: 10 });
  const failed = useJobs({ status: 'failed', limit: 1 });
  const completed = useJobs({ status: 'completed', limit: 6 });
  const cluster = useClusterStatus();

  const active = [...(running.data?.items ?? []), ...(queued.data?.items ?? [])];

  return (
    <div className="settle">
      <PageHeader
        title="Season board"
        sub={`Welcome back, ${user?.name ?? 'driver'}.`}
        actions={
          <>
            {/* Cluster capsule lives in the top strip (direction contract). */}
            <div className="flex items-center gap-3 border border-seam bg-paper px-3 py-1.5">
              <span className="font-condensed flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] uppercase">
                <span
                  className={clsx(
                    'h-2 w-2 rounded-full',
                    cluster.data?.connected ? 'bg-ok' : 'bg-crit',
                    cluster.isLoading && 'bg-seam-strong',
                  )}
                />
                TinkerCliffs
              </span>
              <span className="font-mono tnum hidden text-xs text-ink-2 md:inline">
                {cluster.data?.connected
                  ? `${cluster.data.nodes.idle} idle / ${cluster.data.nodes.total} · queue ${cluster.data.queue.pending}`
                  : cluster.isLoading
                    ? 'checking…'
                    : 'unreachable'}
              </span>
            </div>
            {!guest && (
              <Link to="/runs/new">
                <Button variant="primary">
                  <Plus size={14} strokeWidth={3} /> New run
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Timing tower — one seamed strip, the pit board's column rhythm,
          not a row of hero-metric cards. */}
      <div className="flex flex-col border-y-2 border-ink bg-paper sm:flex-row">
        {(
          [
            ['Runs', all.data?.total, undefined],
            ['On track', running.data?.total, 'text-race-deep'],
            ['In queue', queued.data?.total, undefined],
            ['Finished', completed.data?.total, 'text-ok'],
            ['Failed', failed.data?.total, failed.data?.total ? 'text-crit' : undefined],
          ] as const
        ).map(([label, value, tone], i) => (
          <div
            key={label}
            className={clsx(
              'flex flex-1 items-baseline justify-between gap-3 px-4 py-2 sm:flex-col sm:justify-center sm:gap-0 sm:py-2.5',
              i > 0 && 'border-t border-seam sm:border-t-0 sm:border-l',
            )}
          >
            <span className="font-condensed text-[11px] font-bold tracking-[0.16em] text-ink-3 uppercase">
              {label}
            </span>
            <span className={clsx('font-mono tnum text-xl leading-tight font-semibold', tone ?? 'text-ink')}>
              {value ?? '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_380px]">
        {/* Active runs */}
        <section>
          <h2 className="section-head mb-3">On track now</h2>
          {running.isLoading || queued.isLoading ? (
            <Loading />
          ) : active.length ? (
            <div className="flex flex-col gap-2">
              {active.map((j) => (
                <RunRow key={j.id} job={j} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing on track"
              detail="Submit a run and watch its meshing and solve stages live here."
              action={
                !guest && (
                  <Link to="/runs/new">
                    <Button variant="primary">Start a run</Button>
                  </Link>
                )
              }
            />
          )}
        </section>

        {/* Latest verdicts */}
        <section>
          <h2 className="section-head mb-3">Latest verdicts</h2>
          {completed.isLoading ? (
            <Loading />
          ) : completed.data?.items.length ? (
            <div className="flex flex-col gap-2">
              {completed.data.items.map((j) => (
                <VerdictCard key={j.id} jobId={j.id} name={j.name} createdAt={j.created_at} status={j.status} />
              ))}
              <Link to="/runs?status=completed" className="mt-1 text-sm font-medium text-race hover:underline">
                All finished runs →
              </Link>
            </div>
          ) : (
            <EmptyState title="No finished runs yet" detail="Verdicts land here with Cd / Cl once a solve completes." />
          )}
        </section>
      </div>
    </div>
  );
}

import { useJobForces } from '../lib/queries';
import { plateauStats } from '../lib/plateau';

function VerdictCard({
  jobId,
  name,
  createdAt,
  status,
}: {
  jobId: string;
  name: string;
  createdAt: string;
  status: string;
}) {
  const forces = useJobForces(jobId, status);
  const stats = forces.data ? plateauStats(forces.data) : null;
  return (
    <Link
      to={`/runs/${jobId}`}
      className="group flex items-stretch border border-seam bg-paper transition-colors hover:border-seam-strong"
    >
      <Stripe id={jobId} />
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
        <Roundel id={jobId} size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold group-hover:text-race-deep">{name}</p>
          <p className="text-xs text-ink-3">{formatAgo(createdAt)}</p>
        </div>
        <div className="flex shrink-0 gap-3 text-right">
          <div>
            <p className="font-condensed text-[10px] font-bold tracking-[0.12em] text-ink-3 uppercase">Cd</p>
            <p className="font-mono tnum text-sm font-semibold">{formatCoeff(stats?.cd)}</p>
          </div>
          <div>
            <p className="font-condensed text-[10px] font-bold tracking-[0.12em] text-ink-3 uppercase">Cl</p>
            <p className="font-mono tnum text-sm font-semibold">{formatCoeff(stats?.cl, true)}</p>
          </div>
          {!stats && <StatusChip status="completed" />}
        </div>
      </div>
    </Link>
  );
}
