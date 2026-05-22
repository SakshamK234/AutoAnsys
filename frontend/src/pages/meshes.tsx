import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Filter, Trash2, RefreshCw, X } from 'lucide-react';
import { useMeshes, useDeleteMesh, useSyncMesh } from '@/hooks/use-meshes';
import { formatDate } from '@/lib/utils';
import type { MeshStatus } from '@/types';

const STATUS_FILTERS = ['all', 'draft', 'queued', 'running', 'completed', 'failed'] as const;

const STATUS_STYLES: Record<MeshStatus, string> = {
  draft: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  queued: 'bg-amber-500/15 text-amber-400',
  running: 'bg-blue-500/15 text-blue-400',
  completed: 'bg-emerald-500/15 text-emerald-400',
  failed: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
};

export function MeshesPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');

  const { data, isLoading } = useMeshes({
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const del = useDeleteMesh();
  const sync = useSyncMesh();
  const [err, setErr] = useState<string | null>(null);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete mesh "${name}"? Solver jobs referencing it will block the deletion.`)) return;
    del.mutate(id, {
      onError: (e: any) => setErr(e?.response?.data?.detail ?? 'Failed to delete mesh'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meshes</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Reusable mesh artifacts — one Fluent run, many solver jobs.
          </p>
        </div>
      </div>

      {err && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr(null)} className="rounded p-0.5 hover:bg-red-500/20">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                statusFilter === s
                  ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading...</div>
        ) : !data?.items?.length ? (
          <div className="p-12 text-center">
            <Layers className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))] mb-3" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No meshes yet. Start a new simulation and choose "Mesh only" to create one.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
              <tr className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Geometry</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Cells</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Jobs</th>
                <th className="px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {data.items.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/meshes/${m.id}`)}
                  className="cursor-pointer transition-colors hover:bg-[hsl(var(--accent))]"
                >
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                    {m.geometry_name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[m.status]}`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                    {m.cell_count ? m.cell_count.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                    {m.meshing_minutes != null ? `${m.meshing_minutes} min` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                    {m.jobs_using_count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                    {formatDate(m.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {(m.status === 'queued' || m.status === 'running') && (
                        <button
                          onClick={() => sync.mutate(m.id)}
                          title="Sync status"
                          className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(m.id, m.name)}
                        title="Delete"
                        className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
