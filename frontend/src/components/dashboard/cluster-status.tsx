import { Server, Activity } from 'lucide-react';

interface ClusterStatusProps {
  connected?: boolean;
  nodes?: { total: number; idle: number; allocated: number; down: number };
  queue?: { pending: number; running: number };
}

export function ClusterStatus({ connected = false, nodes, queue }: ClusterStatusProps) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Server className="h-5 w-5 text-[hsl(var(--primary))]" />
        <h3 className="font-semibold">Cluster Status</h3>
        <span className={`ml-auto inline-flex h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
      {connected ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Nodes</p>
            <p className="text-2xl font-bold">{nodes?.idle || 0}<span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">/{nodes?.total || 0} idle</span></p>
          </div>
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Queue</p>
            <p className="text-2xl font-bold">{queue?.running || 0}<span className="text-sm font-normal text-[hsl(var(--muted-foreground))]"> running</span></p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <Activity className="h-4 w-4" />
          <span>Cluster not connected. Configure in admin settings.</span>
        </div>
      )}
    </div>
  );
}
