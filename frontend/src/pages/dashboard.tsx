import { useState } from 'react';
import { ClusterStatus } from '@/components/dashboard/cluster-status';
import { RecentJobs } from '@/components/dashboard/recent-jobs';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { FeaDashboard } from '@/components/fea/fea-dashboard';
import { useAuthStore } from '@/stores/auth-store';
import { useJobs } from '@/hooks/use-jobs';
import { Zap, CheckCircle2, Clock, AlertTriangle, Wind, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardMode = 'cfd' | 'fea';

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

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { data, isLoading } = useJobs({ limit: 5 });

  const [mode, setMode] = useState<DashboardMode>(() => {
    const saved = localStorage.getItem('autoansys_dashboard_mode');
    return saved === 'fea' ? 'fea' : 'cfd';
  });

  const handleModeChange = (m: DashboardMode) => {
    setMode(m);
    localStorage.setItem('autoansys_dashboard_mode', m);
  };

  const jobs = data?.items ?? [];
  const running = jobs.filter((j) => j.status === 'running').length;
  const completed = jobs.filter((j) => j.status === 'completed').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;

  const greeting = isGuest
    ? 'Welcome, Guest'
    : `Welcome back, ${user?.name?.split(' ')[0] || 'Engineer'}`;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {mode === 'cfd'
              ? "Here's an overview of your simulation pipeline"
              : "Here's an overview of your structural analysis jobs"}
          </p>
        </div>

        {/* Mode switcher */}
        <div className="flex rounded-lg bg-[hsl(var(--muted))] p-1 shrink-0">
          <button
            onClick={() => handleModeChange('cfd')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-all',
              mode === 'cfd'
                ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            )}
          >
            <Wind className="h-3.5 w-3.5" />
            CFD Simulations
          </button>
          <button
            onClick={() => handleModeChange('fea')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-all',
              mode === 'fea'
                ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            )}
          >
            <Wrench className="h-3.5 w-3.5" />
            FEA Analysis
          </button>
        </div>
      </div>

      {mode === 'cfd' ? (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Zap} label="Total Sims" value={data?.total ?? 0} />
            <StatCard
              icon={Clock}
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
              icon={AlertTriangle}
              label="Failed"
              value={failed}
              accent="bg-rose-500/10 text-rose-500"
            />
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
        </>
      ) : (
        <FeaDashboard />
      )}
    </div>
  );
}
