import { cn } from '@/lib/utils';
import type { JobStatus } from '@/types';

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  queued: { label: 'Queued', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  meshing: { label: 'Meshing', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  running: { label: 'Running', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 animate-pulse' },
  solving: { label: 'Solving', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 animate-pulse' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

export function JobStatusBadge({ status }: { status: JobStatus | string }) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
