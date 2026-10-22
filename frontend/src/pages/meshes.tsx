import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useMeshes } from '../lib/queries';
import { useAuth, isGuest } from '../stores/auth';
import { PageHeader } from '../components/chrome';
import { Button, EmptyState, Loading } from '../components/ui';
import { StatusChip, Stripe } from '../components/livery';
import { StageProgress } from '../components/stage-progress';
import { formatAgo, formatCells } from '../lib/format';
import type { JobStatus } from '../types';

export default function MeshesPage() {
  const meshes = useMeshes();
  const { user } = useAuth();

  return (
    <div className="settle">
      <PageHeader
        title="Meshes"
        sub="Reusable mesh artifacts — one mesh, many solves."
        actions={
          !isGuest(user) && (
            <Link to="/runs/new">
              <Button variant="primary">
                <Plus size={14} strokeWidth={3} /> New mesh
              </Button>
            </Link>
          )
        }
      />

      {meshes.isLoading ? (
        <Loading label="Loading meshes" />
      ) : meshes.data?.items.length ? (
        <div className="flex flex-col gap-2">
          {meshes.data.items.map((m) => (
            <Link
              key={m.id}
              to={`/meshes/${m.id}`}
              className="group flex items-stretch border border-seam bg-paper transition-colors hover:border-seam-strong"
            >
              <Stripe id={m.id} />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold group-hover:text-race-deep">{m.name}</span>
                    <StatusChip status={m.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {m.geometry_name ?? 'geometry'} · {formatAgo(m.created_at)}
                    {m.error_message && m.status === 'failed' ? ` · ${m.error_message.slice(0, 80)}` : ''}
                  </p>
                  {(m.status === 'running' || m.status === 'queued') && (
                    <div className="mt-1.5">
                      <StageProgress progress={m.progress} status={m.status as JobStatus} compact />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-5 text-right">
                  <div>
                    <p className="font-condensed text-[10px] font-bold tracking-[0.12em] text-ink-3 uppercase">Cells</p>
                    <p className="font-mono tnum text-sm font-semibold">{formatCells(m.cell_count)}</p>
                  </div>
                  <div>
                    <p className="font-condensed text-[10px] font-bold tracking-[0.12em] text-ink-3 uppercase">Mesh time</p>
                    <p className="font-mono tnum text-sm font-semibold">
                      {m.meshing_minutes != null ? `${m.meshing_minutes.toFixed(0)} min` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="font-condensed text-[10px] font-bold tracking-[0.12em] text-ink-3 uppercase">Used by</p>
                    <p className="font-mono tnum text-sm font-semibold">{m.jobs_using_count ?? 0} runs</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No meshes yet"
          detail="Create a mesh-only run to build a reusable mesh, then iterate on solver settings without re-meshing."
        />
      )}
    </div>
  );
}
