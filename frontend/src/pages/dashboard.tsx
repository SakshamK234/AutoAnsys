import { ClusterStatus } from '@/components/dashboard/cluster-status';
import { RecentJobs } from '@/components/dashboard/recent-jobs';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { useAuthStore } from '@/stores/auth-store';
import { useJobs } from '@/hooks/use-jobs';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useJobs({ limit: 5 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {user?.name?.split(' ')[0] || 'Engineer'}
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Here's your simulation overview
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ClusterStatus />
        <QuickActions />
      </div>

      <RecentJobs jobs={data?.items ?? []} loading={isLoading} />
    </div>
  );
}
