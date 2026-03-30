import { PARTITIONS } from '@/lib/constants';
import type { SlurmConfig } from '@/types';

interface ResourceConfigStepProps {
  config: SlurmConfig;
  setConfig: (config: SlurmConfig) => void;
}

export function ResourceConfigStep({ config, setConfig }: ResourceConfigStepProps) {
  const totalCores = config.nodes * config.cores_per_node;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">HPC Resources</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Configure SLURM job resources for the cluster.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1">Job Name</label>
          <input type="text" value={config.job_name} onChange={(e) => setConfig({ ...config, job_name: e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Number of Nodes</label>
          <input type="number" min={1} value={config.nodes} onChange={(e) => setConfig({ ...config, nodes: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Cores per Node</label>
          <input type="number" min={1} value={config.cores_per_node} onChange={(e) => setConfig({ ...config, cores_per_node: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Memory per Node (GB)</label>
          <input type="number" min={1} value={config.memory_gb} onChange={(e) => setConfig({ ...config, memory_gb: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Wall Time (hours)</label>
          <input type="number" min={1} max={72} value={config.walltime_hours} onChange={(e) => setConfig({ ...config, walltime_hours: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Partition</label>
          <select value={config.partition} onChange={(e) => setConfig({ ...config, partition: e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm">
            {PARTITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4">
        <p className="text-sm font-medium">Resource Summary</p>
        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-[hsl(var(--muted-foreground))]">Total Cores:</span> <span className="font-mono font-bold">{totalCores}</span></div>
          <div><span className="text-[hsl(var(--muted-foreground))]">Total Memory:</span> <span className="font-mono font-bold">{config.nodes * config.memory_gb} GB</span></div>
          <div><span className="text-[hsl(var(--muted-foreground))]">Max Duration:</span> <span className="font-mono font-bold">{config.walltime_hours}h</span></div>
        </div>
      </div>
    </div>
  );
}
