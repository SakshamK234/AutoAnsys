import { ClusterStatus } from '@/components/dashboard/cluster-status';
import { RecentJobs } from '@/components/dashboard/recent-jobs';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { useAuthStore } from '@/stores/auth-store';
import { useJobs } from '@/hooks/use-jobs';
import { useMeshes } from '@/hooks/use-meshes';
import { Zap, CheckCircle2, Clock, AlertTriangle, Grid3x3 } from 'lucide-react';

/** Telemetry tile — the readout style for every headline number. */
function StatCard({ icon: Icon, label, value, signal }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  signal?: 'queued' | 'running' | 'complete' | 'failed';
}) {
  const iconClass = signal
    ? `signal-${signal}`
    : 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]';
  return (
    <div className="pit-card pit-card--rail p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--muted-foreground))]">
          {label}
        </p>
        <div className={`rounded-md p-1.5 ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="telemetry-hero mt-3 text-4xl">{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { data, isLoading } = useJobs({ limit: 5 });
  const { data: meshData } = useMeshes({ limit: 1 });

  const jobs = data?.items ?? [];
  const running = jobs.filter((j) => j.status === 'running').length;
  const completed = jobs.filter((j) => j.status === 'completed').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const totalMeshes = meshData?.total ?? 0;

  const greeting = isGuest
    ? 'Guest on the pit wall'
    : `On the wall: ${user?.name?.split(' ')[0] || 'Engineer'}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="speed-lines font-display text-2xl font-bold uppercase tracking-wide">
          {greeting}
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-3">
          Session overview — runs, meshes, and cluster state at a glance
        </p>
      </div>

      {/* Telemetry tiles */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Zap} label="Total Runs" value={data?.total ?? 0} />
        <StatCard icon={Grid3x3} label="Meshes" value={totalMeshes} />
        <StatCard icon={Clock} label="On Track" value={running} signal="running" />
        <StatCard icon={CheckCircle2} label="Checkered" value={completed} signal="complete" />
        <StatCard icon={AlertTriangle} label="Red Flag" value={failed} signal="failed" />
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentJobs jobs={jobs} loading={isLoading} />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <ClusterStatus />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
