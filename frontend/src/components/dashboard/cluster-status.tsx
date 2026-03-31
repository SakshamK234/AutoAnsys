import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Server, Activity, Wifi, WifiOff } from 'lucide-react';
import type { ClusterStatus as ClusterStatusType } from '@/types';

export function ClusterStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['cluster-status'],
    queryFn: async () => {
      const res = await api.get<ClusterStatusType>('/cluster/status');
      return res.data;
    },
    refetchInterval: 60000, // refresh every 60s
  });

  const connected = data?.connected ?? false;
  const nodes = data?.nodes;
  const queue = data?.queue;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-lg bg-[hsl(var(--primary)/0.1)] p-2">
          <Server className="h-4 w-4 text-[hsl(var(--primary))]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">HPC Cluster</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isLoading ? (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Checking...</span>
            ) : (
              <>
                <span className={`inline-flex h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </>
            )}
          </div>
        </div>
        {connected
          ? <Wifi className="h-4 w-4 text-emerald-500" />
          : <WifiOff className="h-4 w-4 text-rose-500" />
        }
      </div>
      {connected ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-[hsl(var(--background))] p-3">
            <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Nodes</p>
            <p className="text-xl font-bold mt-1">{nodes?.idle || 0}
              <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]"> / {nodes?.total || 0}</span>
            </p>
          </div>
          <div className="rounded-lg bg-[hsl(var(--background))] p-3">
            <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Queue</p>
            <p className="text-xl font-bold mt-1">{queue?.running || 0}
              <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]"> active</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--background))] p-3 text-xs text-[hsl(var(--muted-foreground))]">
          <Activity className="h-3.5 w-3.5 shrink-0" />
          <span>{data?.message || 'Configure cluster connection in settings to submit jobs.'}</span>
        </div>
      )}
    </div>
  );
}
