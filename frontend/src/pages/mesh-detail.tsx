import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useMesh, useMeshMutations } from '../lib/queries';
import { errorText } from '../lib/api';
import { useAuth, isGuest } from '../stores/auth';
import { Button, ConfirmButton, EmptyState, Loading, Panel, useToast } from '../components/ui';
import { Roundel, Stamp, StatTile, StatusChip, Stripe } from '../components/livery';
import { StageProgress } from '../components/stage-progress';
import { formatAgo, formatCells, formatDate } from '../lib/format';
import type { JobStatus } from '../types';

const ACTIVE = new Set(['queued', 'running']);

export default function MeshDetailPage() {
  const { id } = useParams<{ id: string }>();
  const mesh = useMesh(id);
  const mut = useMeshMutations();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const guest = isGuest(user);

  if (mesh.isLoading) return <Loading label="Loading mesh" />;
  if (mesh.isError || !mesh.data)
    return (
      <EmptyState
        title="Mesh not found"
        detail="It may have been deleted, or you don't have access."
        action={
          <Link to="/meshes">
            <Button>Back to meshes</Button>
          </Link>
        }
      />
    );

  const m = mesh.data;
  const isOwner = m.user_id === user?.id;
  const act = (fn: { mutateAsync: (id: string) => Promise<unknown> }, ok: string) =>
    fn
      .mutateAsync(m.id)
      .then(() => toast('ok', ok))
      .catch((e) => toast('error', errorText(e)));

  return (
    <div className="settle">
      <div className="flex items-stretch border border-seam bg-paper">
        <Stripe id={m.id} className="w-[18px]" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 px-5 py-4">
          <Roundel id={m.id} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display truncate text-[22px] leading-tight font-bold">{m.name}</h1>
              {ACTIVE.has(m.status) || m.status === 'draft' ? <StatusChip status={m.status} /> : <Stamp status={m.status} />}
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {m.geometry_name ?? 'geometry'} · created {formatAgo(m.created_at)}
              {m.slurm_job_id && ` · SLURM ${m.slurm_job_id}`}
              {m.completed_at && ` · finished ${formatDate(m.completed_at)}`}
            </p>
            {ACTIVE.has(m.status) && (
              <div className="mt-3">
                <StageProgress progress={m.progress} status={m.status as JobStatus} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOwner && !guest && m.status === 'draft' && (
              <Button variant="primary" busy={mut.submit.isPending} onClick={() => act(mut.submit, 'Mesh submitted')}>
                Submit mesh
              </Button>
            )}
            {m.status === 'completed' && !guest && (
              <Link to="/runs/new">
                <Button variant="primary">Solve from this mesh</Button>
              </Link>
            )}
            {ACTIVE.has(m.status) && (
              <Button variant="ghost" busy={mut.sync.isPending} onClick={() => act(mut.sync, 'Status synced')}>
                <RefreshCw size={13} /> Sync
              </Button>
            )}
            <span className="mx-2 hidden h-6 w-px bg-seam sm:block" aria-hidden />
            {isOwner && !guest && ACTIVE.has(m.status) && (
              <ConfirmButton
                label="Cancel"
                confirmLabel="Cancel mesh?"
                busy={mut.cancel.isPending}
                onConfirm={() => act(mut.cancel, 'Cancel requested')}
              />
            )}
            {isOwner && !guest && !ACTIVE.has(m.status) && (
              <ConfirmButton
                label="Delete"
                confirmLabel="Delete mesh?"
                busy={mut.remove.isPending}
                onConfirm={() =>
                  mut.remove
                    .mutateAsync(m.id)
                    .then(() => {
                      toast('ok', 'Mesh deleted');
                      navigate('/meshes');
                    })
                    .catch((e) => toast('error', errorText(e)))
                }
              />
            )}
          </div>
        </div>
      </div>

      {m.status === 'failed' && (
        <Panel className="mt-4 border-crit/40 bg-crit-tint/40">
          <div className="flex gap-3 px-5 py-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-crit" />
            <div>
              <p className="font-condensed text-[12px] font-bold tracking-[0.12em] text-crit uppercase">
                Why this mesh failed
              </p>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed">
                {m.error_message ?? 'No failure reason captured — check the workspace logs on the cluster.'}
              </p>
            </div>
          </div>
        </Panel>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Cell count" value={formatCells(m.cell_count)} />
        <StatTile
          label="Meshing time"
          value={m.meshing_minutes != null ? m.meshing_minutes.toFixed(0) : '—'}
          unit={m.meshing_minutes != null ? 'min' : undefined}
        />
        <StatTile label="Runs using it" value={String(m.jobs_using_count ?? 0)} />
        <StatTile label="Workflow" value={String((m.config?.mesh as { workflow?: string } | undefined)?.workflow ?? 'FT')} />
      </div>

      <section className="mt-8">
        <h2 className="section-head mb-3">Recipe</h2>
        <pre className="font-mono max-h-96 overflow-auto border border-seam bg-ink p-4 text-[12px] leading-relaxed text-[#d6d9e0]">
          {JSON.stringify(m.config, null, 2)}
        </pre>
      </section>
    </div>
  );
}
