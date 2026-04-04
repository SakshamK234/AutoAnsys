import { ClusterStatus } from '@/components/dashboard/cluster-status';
import { FeaRecentJobs } from './fea-recent-jobs';
import { FeaQuickActions } from './fea-quick-actions';
import { useFeaJobs } from '@/hooks/use-fea';
import { Wrench, Activity, CheckCircle2, XCircle } from 'lucide-react';

function StatCard({ icon: Icon, label, value, accent }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{label}</p>
        <div className={`rounded-lg p-1.5 ${accent || 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export function FeaDashboard() {
  const { data, isLoading } = useFeaJobs();

  const jobs = data?.items ?? [];
  const running = jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;
  const completed = jobs.filter((j) => j.status === 'completed').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;

  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wrench} label="Total FEA Jobs" value={data?.total ?? 0} />
        <StatCard
          icon={Activity}
          label="Running"
          value={running}
          accent="bg-amber-500/10 text-amber-500"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={completed}
          accent="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard
          icon={XCircle}
          label="Failed"
          value={failed}
          accent="bg-rose-500/10 text-rose-500"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FeaRecentJobs jobs={jobs} loading={isLoading} />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <ClusterStatus />
          <FeaQuickActions />
        </div>
      </div>
    </>
  );
}
