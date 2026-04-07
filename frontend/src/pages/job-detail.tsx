import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResidualChart } from '@/components/jobs/residual-chart';
import { ForceChart } from '@/components/jobs/force-chart';
import { JobStatusBadge } from '@/components/jobs/job-status-badge';
import { useJob, useJobForces, useJobResiduals, useCancelJob, useSyncJobStatus } from '@/hooks/use-jobs';
import { cn, formatDate, formatFileSize } from '@/lib/utils';
import { ArrowLeft, XCircle, Download, FileIcon, FileText, Image } from 'lucide-react';
import api from '@/lib/api';

interface ResultFile {
  id: string;
  job_id: string;
  filename: string;
  file_type: string;
  s3_key: string;
  file_size: number;
  created_at: string;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  forces_csv: 'Force Coefficients',
  residuals_csv: 'Residual History',
  case_data: 'Case Data',
  slurm_log: 'SLURM Log',
  contour_image: 'Contour Image',
};

const CONTOUR_LABELS: Record<string, string> = {
  'contour_velocity.png': 'Velocity Magnitude',
  'contour_pressure.png': 'Static Pressure',
  'contour_total_pressure.png': 'Total Pressure',
  'contour_wall_shear.png': 'Wall Shear Stress',
};

const tabs = ['Overview', 'Residuals', 'Forces', 'Contours', 'Files', 'Config'] as const;

function ContourCard({ file, jobId }: { file: ResultFile; jobId: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fetch presigned URL on mount
  useEffect(() => {
    api
      .get<{ url: string; filename: string }>(`/files/${jobId}/download/${file.id}`)
      .then((res) => {
        setImgUrl(res.data.url);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [jobId, file.id]);

  const label = CONTOUR_LABELS[file.filename] || file.filename;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 text-[hsl(var(--primary))]" />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        {imgUrl && (
          <a
            href={imgUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-2.5 py-1 text-xs font-medium hover:bg-[hsl(var(--accent))] transition-colors"
          >
            <Download className="h-3 w-3" />
            Download
          </a>
        )}
      </div>
      <div className="relative aspect-video bg-black/5">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Failed to load image</p>
          </div>
        )}
        {imgUrl && !error && (
          <img
            src={imgUrl}
            alt={label}
            className="w-full h-full object-contain"
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>
  );
}

export function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: job, isLoading } = useJob(id);
  const { data: forces } = useJobForces(id);
  const { data: residuals } = useJobResiduals(id);
  const cancelJob = useCancelJob();
  const syncStatus = useSyncJobStatus();
  const [activeTab, setActiveTab] = useState<string>('Overview');

  const isActive = job?.status === 'queued' || job?.status === 'running';

  // WebSocket for live updates on active jobs
  const ws = useWebSocket(isActive ? id : undefined);

  // When WS reports a terminal status, invalidate queries to refresh data
  useEffect(() => {
    if (ws.status && (ws.status === 'completed' || ws.status === 'failed' || ws.status === 'cancelled')) {
      queryClient.invalidateQueries({ queryKey: ['jobs', id] });
      queryClient.invalidateQueries({ queryKey: ['jobs', id, 'forces'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', id, 'residuals'] });
      queryClient.invalidateQueries({ queryKey: ['files', id] });
    }
  }, [ws.status, id, queryClient]);

  // Merge WS live data with API data
  const mergedResiduals = useMemo(() => {
    const apiData = residuals ?? [];
    if (ws.residuals.length === 0) return apiData;
    // If API data exists, append only new WS points beyond last API iteration
    const lastApiIter = apiData.length > 0 ? apiData[apiData.length - 1].iteration : 0;
    const newPoints = ws.residuals.filter((r) => r.iteration > lastApiIter);
    return [...apiData, ...newPoints];
  }, [residuals, ws.residuals]);

  const mergedForces = useMemo(() => {
    const apiData = forces ?? [];
    if (ws.forces.length === 0) return apiData;
    const lastApiIter = apiData.length > 0 ? apiData[apiData.length - 1].iteration : 0;
    const newPoints = ws.forces.filter((f) => f.iteration > lastApiIter);
    return [...apiData, ...newPoints];
  }, [forces, ws.forces]);

  // Effective status: prefer WS live status over API for responsiveness
  const liveStatus = ws.status || job?.status;

  // Auto-sync with cluster every 10s for active jobs (fallback when WS disconnected)
  useEffect(() => {
    if (!id || !isActive || ws.connected) return;
    const interval = setInterval(() => {
      syncStatus.mutate(id);
    }, 10_000);
    return () => clearInterval(interval);
  }, [id, isActive, ws.connected]);

  const { data: files } = useQuery({
    queryKey: ['files', id],
    queryFn: async () => {
      const res = await api.get<ResultFile[]>(`/files/${id}`);
      return res.data;
    },
    enabled: !!id && job?.status === 'completed',
  });

  const handleDownloadFile = async (fileId: string) => {
    try {
      const res = await api.get<{ url: string; filename: string }>(`/files/${id}/download/${fileId}`);
      window.open(res.data.url, '_blank');
    } catch {
      // silently fail
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Job not found.</p>
        <button onClick={() => navigate('/jobs')} className="mt-2 text-sm font-medium text-[hsl(var(--primary))] hover:underline">
          Back to simulations
        </button>
      </div>
    );
  }

  const canCancel = job.status === 'queued' || job.status === 'running';

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/jobs')}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to simulations
      </button>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
            <JobStatusBadge status={liveStatus || job.status} />
            {ws.connected && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                <Radio className="h-3 w-3 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="font-mono text-xs text-[hsl(var(--muted-foreground))] mt-1">{job.id}</p>
        </div>
        <div className="flex items-center gap-2">
          {canCancel && (
            <button
              onClick={() => syncStatus.mutate(job.id)}
              disabled={syncStatus.isPending}
              className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-medium hover:bg-[hsl(var(--accent))] disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncStatus.isPending && "animate-spin")} />
              Sync Status
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => cancelJob.mutate(job.id)}
              disabled={cancelJob.isPending}
              className="flex items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel Job
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-md px-4 py-1.5 text-xs font-medium transition-all',
              activeTab === tab
                ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Status', value: job.status },
              { label: 'Created', value: formatDate(job.created_at) },
              job.owner_name ? { label: 'Owner', value: job.owner_name } : null,
              job.group_name ? { label: 'Group', value: job.group_name } : null,
              job.submitted_at ? { label: 'Submitted', value: formatDate(job.submitted_at) } : null,
              job.started_at ? { label: 'Started', value: formatDate(job.started_at) } : null,
              job.completed_at ? { label: 'Completed', value: formatDate(job.completed_at) } : null,
              job.slurm_job_id ? { label: 'SLURM Job ID', value: job.slurm_job_id, mono: true } : null,
              { label: 'Geometry ID', value: job.geometry_id, mono: true },
            ].filter(Boolean).map((item, i) => (
              <div key={i} className="rounded-lg bg-[hsl(var(--background))] px-4 py-3">
                <p className="text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{item!.label}</p>
                <p className={cn('text-sm font-medium mt-1', (item as any).mono && 'font-mono text-xs')}>
                  {item!.value}
                </p>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'Residuals' && <ResidualChart data={mergedResiduals} />}
        {activeTab === 'Forces' && <ForceChart data={mergedForces} />}
        {activeTab === 'Contours' && (
          <div>
            {job.status !== 'completed' ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Image className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-3" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Contour images will be available once the job completes.
                </p>
              </div>
            ) : (() => {
              const contourFiles = (files ?? []).filter((f) => f.file_type === 'contour_image');
              if (contourFiles.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Image className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-3" />
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                      No contour images found.
                    </p>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {contourFiles.map((f) => (
                    <ContourCard key={f.id} file={f} jobId={id!} />
                  ))}
                </div>
              );
            })()}
          </div>
        )}
        {activeTab === 'Files' && (
          <div>
            {job.status !== 'completed' ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileIcon className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-3" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Result files will be available once the job completes.
                </p>
              </div>
            ) : !files || files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileIcon className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-3" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No result files found.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-4 rounded-lg bg-[hsl(var(--background))] px-4 py-3 transition-colors hover:bg-[hsl(var(--muted))]"
                  >
                    <div className="rounded-lg bg-[hsl(var(--primary)/0.1)] p-2">
                      {f.file_type === 'contour_image' ? (
                        <Image className="h-4 w-4 text-[hsl(var(--primary))]" />
                      ) : (
                        <FileText className="h-4 w-4 text-[hsl(var(--primary))]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.filename}</p>
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                        {FILE_TYPE_LABELS[f.file_type] || f.file_type} &middot; {formatFileSize(f.file_size)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownloadFile(f.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium hover:bg-[hsl(var(--accent))] transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'Config' && (
          <pre className="rounded-lg bg-[hsl(var(--background))] p-4 text-xs overflow-auto max-h-[600px] font-mono">
            {JSON.stringify(job.config, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
