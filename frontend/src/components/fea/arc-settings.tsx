import { FEA_PARTITIONS } from '@/lib/fea-constants';
import type { FEAArcSettings } from '@/types/fea';

interface ArcSettingsProps {
  settings: FEAArcSettings;
  onChange: (settings: FEAArcSettings) => void;
}

export function ArcSettings({ settings, onChange }: ArcSettingsProps) {
  const totalCores = settings.nodes * settings.tasks_per_node;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1">Job Name</label>
          <input
            type="text"
            value={settings.job_name}
            onChange={(e) => onChange({ ...settings, job_name: e.target.value })}
            placeholder="bracket_static_001"
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Partition</label>
          <select
            value={settings.partition}
            onChange={(e) => onChange({ ...settings, partition: e.target.value })}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
          >
            {FEA_PARTITIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Nodes</label>
          <input
            type="number"
            min={1}
            max={4}
            value={settings.nodes}
            onChange={(e) => onChange({ ...settings, nodes: +e.target.value })}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Tasks per Node</label>
          <input
            type="number"
            min={1}
            value={settings.tasks_per_node}
            onChange={(e) => onChange({ ...settings, tasks_per_node: +e.target.value })}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Walltime (HH:MM:SS)</label>
          <input
            type="text"
            value={settings.walltime}
            onChange={(e) => onChange({ ...settings, walltime: e.target.value })}
            placeholder="01:00:00"
            pattern="\d{2}:\d{2}:\d{2}"
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm font-mono"
          />
        </div>
      </div>

      <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4">
        <p className="text-sm font-medium">Resource Summary</p>
        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">Total Cores:</span>{' '}
            <span className="font-mono font-bold">{totalCores}</span>
          </div>
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">Nodes:</span>{' '}
            <span className="font-mono font-bold">{settings.nodes}</span>
          </div>
          <div>
            <span className="text-[hsl(var(--muted-foreground))]">Walltime:</span>{' '}
            <span className="font-mono font-bold">{settings.walltime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
