import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import type { Job } from '../types';
import { formatAgo } from '../lib/format';
import { Stripe, Roundel, StatusChip } from './livery';
import { StageProgress } from './stage-progress';

/** A striped run row — the core list unit across the app. */
export function RunRow({ job, showOwner = false, dense = false }: { job: Job; showOwner?: boolean; dense?: boolean }) {
  return (
    <Link
      to={`/runs/${job.id}`}
      className="group flex items-stretch border border-seam bg-paper transition-colors hover:border-seam-strong"
    >
      <Stripe id={job.id} />
      <div className={clsx('flex min-w-0 flex-1 items-center gap-3', dense ? 'px-3 py-2' : 'px-4 py-3')}>
        <Roundel id={job.id} size={dense ? 28 : 34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink group-hover:text-race-deep">
              {job.name}
            </span>
            <StatusChip status={job.status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-3">
            {job.config?.cfd_mode === 'full_car' ? 'Full car' : 'Individual part'}
            {job.mesh ? ` · mesh: ${job.mesh.name}` : ''}
            {showOwner && job.owner_name ? ` · ${job.owner_name}` : ''}
            {job.group_name ? ` · ${job.group_name}` : ''}
            {' · '}
            {formatAgo(job.created_at)}
          </p>
          {(job.status === 'running' || job.status === 'queued') && (
            <div className="mt-1.5">
              <StageProgress progress={job.progress} status={job.status} compact />
            </div>
          )}
          {job.status === 'failed' && job.error_message && (
            <p className="mt-1 line-clamp-1 text-xs text-crit">{job.error_message}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
