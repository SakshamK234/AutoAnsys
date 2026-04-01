import { cn } from '@/lib/utils';
import type { JobStatus } from '@/types';

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  queued: { label: 'Queued', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  meshing: { label: 'Meshing', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300' },
  running: { label: 'Running', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 animate-pulse' },
  solving: { label: 'Solving', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300 animate-pulse' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  failed: { label: 'Failed', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' },
  cancelled: { label: 'Cancelled', className: 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400' },
};

export function JobStatusBadge({ status }: { status: JobStatus | string }) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
