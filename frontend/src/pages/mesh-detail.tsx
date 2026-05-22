import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  XCircle,
  Play,
  Box,
  Clock,
  Hash,
  Layers,
  FileBox,
} from 'lucide-react';
import { useMesh, useSubmitMesh, useSyncMesh, useCancelMesh } from '@/hooks/use-meshes';
import { formatDate } from '@/lib/utils';
import type { MeshStatus } from '@/types';

const STATUS_STYLES: Record<MeshStatus, string> = {
  draft: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
  queued: 'bg-amber-500/15 text-amber-400',
  running: 'bg-blue-500/15 text-blue-400',
  completed: 'bg-emerald-500/15 text-emerald-400',
  failed: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
};

export function MeshDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: mesh, isLoading } = useMesh(id);
  const submit = useSubmitMesh();
  const sync = useSyncMesh();
  const cancel = useCancelMesh();

  if (isLoading || !mesh) {
    return <div className="p-8 text-sm text-[hsl(var(--muted-foreground))]">Loading mesh...</div>;
  }

  const canSubmit = mesh.status === 'draft';
  const canCancel = mesh.status === 'queued' || mesh.status === 'running';
  const canSync = mesh.status === 'queued' || mesh.status === 'running';

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate('/meshes')}
          className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Meshes
        </button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{mesh.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[mesh.status]}`}
            >
              {mesh.status}
            </span>
            {mesh.slurm_job_id && (
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                SLURM: {mesh.slurm_job_id}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <button
              onClick={() => submit.mutate(mesh.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110"
            >
              <Play className="h-3 w-3" /> Submit
            </button>
          )}
          {canSync && (
            <button
              onClick={() => sync.mutate(mesh.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--accent))]"
            >
              <RefreshCw className="h-3 w-3" /> Sync
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => cancel.mutate(mesh.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
            >
              <XCircle className="h-3 w-3" /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Layers className="h-4 w-4" />}
          label="Cells"
          value={mesh.cell_count ? mesh.cell_count.toLocaleString() : '—'}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Meshing Time"
          value={mesh.meshing_minutes != null ? `${mesh.meshing_minutes} min` : '—'}
        />
        <StatCard
          icon={<FileBox className="h-4 w-4" />}
          label="Jobs Using"
          value={String(mesh.jobs_using_count ?? 0)}
        />
        <StatCard
          icon={<Hash className="h-4 w-4" />}
          label="Config Hash"
          value={mesh.config_hash.slice(0, 8) + '…'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Metadata">
          <Row label="Geometry">
            <Link to={`/geometries`} className="text-[hsl(var(--primary))] hover:underline">
              <Box className="inline h-3 w-3 mr-1" />
              {mesh.geometry_name ?? mesh.geometry_id}
            </Link>
          </Row>
          <Row label="Owner">{mesh.owner_name ?? '—'}</Row>
          <Row label="Group">{mesh.group_name ?? 'Personal'}</Row>
          <Row label="Created">{formatDate(mesh.created_at)}</Row>
          <Row label="Submitted">
            {mesh.submitted_at ? formatDate(mesh.submitted_at) : '—'}
          </Row>
          <Row label="Started">{mesh.started_at ? formatDate(mesh.started_at) : '—'}</Row>
          <Row label="Completed">
            {mesh.completed_at ? formatDate(mesh.completed_at) : '—'}
          </Row>
          <Row label="Workspace">
            <code className="text-xs">{mesh.cluster_workspace ?? '—'}</code>
          </Row>
          <Row label="Case File">
            <code className="text-xs">{mesh.case_file_s3_key ?? '—'}</code>
          </Row>
        </Panel>

        <Panel title="Mesh Config">
          <pre className="max-h-96 overflow-auto rounded-lg bg-[hsl(var(--muted)/0.4)] p-3 text-[11px] leading-relaxed">
            {JSON.stringify(mesh.config?.mesh, null, 2)}
          </pre>
        </Panel>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="text-right text-[hsl(var(--foreground))]">{children}</span>
    </div>
  );
}
