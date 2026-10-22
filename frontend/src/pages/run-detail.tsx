import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Check, Download, FileText, RefreshCw } from 'lucide-react';
import {
  fileDownloadUrl,
  useJob,
  useJobFiles,
  useJobForces,
  useJobMutations,
  useJobResiduals,
} from '../lib/queries';
import { useJobLive } from '../lib/live';
import { errorText } from '../lib/api';
import { formatAgo, formatBytes, formatCoeff, formatDate, formatDuration, formatForce } from '../lib/format';
import { useAuth, isGuest } from '../stores/auth';
import { Button, ConfirmButton, EmptyState, Loading, Panel, Tabs, useToast } from '../components/ui';
import { Plate, Roundel, Stamp, StatusChip, Stripe } from '../components/livery';
import { StageProgress } from '../components/stage-progress';
import { ForceChart, ResidualChart } from '../components/charts';
import { plateauStats } from '../lib/plateau';
import { ContourGallery } from '../components/contours';
import { useTemplateMutations } from '../lib/queries';
import type { ResultFile } from '../types';

const ACTIVE = new Set(['queued', 'running']);

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const job = useJob(id);
  // Keep the socket open for the whole visit: results_ready and the final
  // status land after the run flips terminal, and we want those refetches.
  const live = useJobLive(id);
  const status = job.data?.status;
  const forces = useJobForces(id, status);
  const residuals = useJobResiduals(id, status);
  const files = useJobFiles(id, status);
  const mutations = useJobMutations(id);
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const guest = isGuest(user);
  const [tab, setTab] = useState('convergence');

  if (job.isLoading) return <Loading label="Loading run" />;
  if (job.isError || !job.data)
    return (
      <EmptyState
        title="Run not found"
        detail="It may have been deleted, or you don't have access."
        action={
          <Link to="/runs">
            <Button>Back to runs</Button>
          </Link>
        }
      />
    );

  const j = job.data;
  const isOwner = j.user_id === user?.id;
  const stats = forces.data?.length ? plateauStats(forces.data, j.config?.solver.convergence.force_monitor_window ?? 50) : null;
  const progress = live.progress ?? j.progress;

  const act = (m: { mutateAsync: (id: string) => Promise<unknown> }, ok: string) =>
    m
      .mutateAsync(j.id)
      .then(() => toast('ok', ok))
      .catch((e) => toast('error', errorText(e)));

  return (
    <div className="settle">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-stretch border border-seam bg-paper">
        <Stripe id={j.id} className="w-[18px]" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4 px-5 py-4">
          <Roundel id={j.id} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display truncate text-[22px] leading-tight font-bold">{j.name}</h1>
              {ACTIVE.has(j.status) || j.status === 'draft' ? <StatusChip status={j.status} /> : <Stamp status={j.status} />}
              {live.connected && ACTIVE.has(j.status) && (
                <span className="font-condensed flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-race uppercase">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-race" /> Live telemetry
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {j.config?.cfd_mode === 'full_car' ? 'Full car' : 'Individual part'}
              {j.mesh && (
                <>
                  {' · mesh '}
                  <Link className="text-race hover:underline" to={`/meshes/${j.mesh.id}`}>
                    {j.mesh.name}
                  </Link>
                </>
              )}
              {j.owner_name ? ` · ${j.owner_name}` : ''}
              {j.group_name ? ` · ${j.group_name}` : ''}
              {' · created '}
              {formatAgo(j.created_at)}
              {j.started_at && ` · ran ${formatDuration(j.started_at, j.completed_at)}`}
              {j.slurm_job_id && ` · SLURM ${j.slurm_job_id}`}
            </p>
            {(ACTIVE.has(j.status) || j.status === 'completed') && (
              <div className="mt-3">
                <StageProgress progress={progress} status={j.status} />
              </div>
            )}
          </div>

          {/* Actions. Destructive ones sit isolated on the far edge. */}
          <div className="flex items-center gap-2">
            {isOwner && !guest && j.status === 'draft' && (
              <Button variant="primary" busy={mutations.submit.isPending} onClick={() => act(mutations.submit, 'Run submitted')}>
                Submit run
              </Button>
            )}
            {ACTIVE.has(j.status) && (
              <Button variant="ghost" busy={mutations.sync.isPending} onClick={() => act(mutations.sync, 'Status synced')}>
                <RefreshCw size={13} /> Sync
              </Button>
            )}
            {isOwner && !guest && (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') && (
              <Button
                busy={mutations.resubmit.isPending}
                onClick={() =>
                  mutations.resubmit
                    .mutateAsync(j.id)
                    .then((nj) => {
                      toast('ok', 'Run cloned and submitted');
                      navigate(`/runs/${(nj as { id: string }).id}`);
                    })
                    .catch((e) => toast('error', errorText(e)))
                }
              >
                Re-run
              </Button>
            )}
            <span className="mx-2 hidden h-6 w-px bg-seam sm:block" aria-hidden />
            {isOwner && !guest && ACTIVE.has(j.status) && (
              <ConfirmButton
                label="Cancel"
                confirmLabel="Cancel run?"
                busy={mutations.cancel.isPending}
                onConfirm={() => act(mutations.cancel, 'Cancel requested')}
              />
            )}
            {isOwner && !guest && !ACTIVE.has(j.status) && (
              <ConfirmButton
                label="Delete"
                confirmLabel="Delete run?"
                busy={mutations.remove.isPending}
                onConfirm={() =>
                  mutations.remove
                    .mutateAsync(j.id)
                    .then(() => {
                      toast('ok', 'Run deleted');
                      navigate('/runs');
                    })
                    .catch((e) => toast('error', errorText(e)))
                }
              />
            )}
          </div>
        </div>
      </div>
      {j.status === 'completed' && <div className="checker" aria-hidden />}

      {/* ── Failure reason ──────────────────────────────────────────────── */}
      {j.status === 'failed' && (
        <Panel className="mt-4 border-crit/40 bg-crit-tint/40">
          <div className="flex gap-3 px-5 py-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-crit" />
            <div>
              <p className="font-condensed text-[12px] font-bold tracking-[0.12em] text-crit uppercase">
                Why this run failed
              </p>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink">
                {j.error_message ??
                  'No failure reason was captured. Check the SLURM and Fluent logs in the Files tab.'}
              </p>
              <button className="mt-2 cursor-pointer text-sm font-medium text-race hover:underline" onClick={() => setTab('files')}>
                Open the logs →
              </button>
            </div>
          </div>
        </Panel>
      )}

      {/* ── Verdict strip ───────────────────────────────────────────────── */}
      {stats && (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <VerdictTile label="Drag coefficient · Cd" value={formatCoeff(stats.cd)} sub={`σ ${stats.cdSigma.toFixed(4)} over last ${stats.n}`} />
          <VerdictTile
            label="Lift coefficient · Cl"
            value={formatCoeff(stats.cl, true)}
            sub={stats.cl < 0 ? 'downforce' : 'lift'}
          />
          <VerdictTile label="Drag force" value={formatForce(stats.dragN)} sub={`moment ${stats.momentNm.toFixed(1)} N·m`} />
          <div className="flex flex-col justify-center border border-seam bg-paper px-4 py-3">
            <p className="font-condensed text-[11px] font-bold tracking-[0.14em] text-ink-3 uppercase">Convergence</p>
            <p
              className={`font-condensed mt-1 flex items-center gap-1.5 text-[15px] font-bold tracking-[0.1em] uppercase ${
                stats.converged ? 'text-ok' : 'text-warn'
              }`}
            >
              {stats.converged && <Check size={15} strokeWidth={3} />}
              {stats.converged ? 'Plateau reached' : 'Still drifting'}
            </p>
            <p className="text-xs text-ink-3">judged on the last {stats.n} iterations</p>
          </div>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'convergence', label: 'Convergence' },
            { value: 'forces', label: 'Forces' },
            { value: 'contours', label: 'Contours' },
            { value: 'files', label: 'Files' },
            { value: 'config', label: 'Setup' },
          ]}
        />
        <div className="mt-4">
          {tab === 'convergence' && (
            <Plate caption="Fig. — Residual history (log scale)">
              {residuals.data?.length || live.residuals.length ? (
                <ResidualChart
                  data={residuals.data ?? []}
                  live={live.residuals}
                  target={j.config?.solver.convergence.residual_target}
                />
              ) : ACTIVE.has(j.status) ? (
                <p className="py-10 text-center text-sm text-ink-3">
                  Residuals stream in once the solver starts iterating.
                </p>
              ) : (
                <p className="py-10 text-center text-sm text-ink-3">No residual history for this run.</p>
              )}
            </Plate>
          )}
          {tab === 'forces' && (
            <Plate caption="Fig. — Force coefficients vs iteration">
              {forces.data?.length || live.forces.length ? (
                <ForceChart
                  data={forces.data ?? []}
                  live={live.forces}
                  plateauWindow={j.config?.solver.convergence.force_monitor_window ?? 50}
                />
              ) : ACTIVE.has(j.status) ? (
                <p className="py-10 text-center text-sm text-ink-3">
                  Coefficients stream in live during the solve.
                </p>
              ) : (
                <p className="py-10 text-center text-sm text-ink-3">No force history for this run.</p>
              )}
            </Plate>
          )}
          {tab === 'contours' && (files.data ? <ContourGallery jobId={j.id} files={files.data} /> : <Loading />)}
          {tab === 'files' && <FilesTab jobId={j.id} files={files.data} loading={files.isLoading} />}
          {tab === 'config' && <ConfigTab job={j} canTemplate={!guest} />}
        </div>
      </div>
    </div>
  );
}

function VerdictTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-seam bg-paper px-4 py-3">
      <p className="font-condensed text-[11px] font-bold tracking-[0.14em] text-ink-3 uppercase">{label}</p>
      <p className="font-mono tnum mt-1 text-[28px] leading-none font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

function FilesTab({ jobId, files, loading }: { jobId: string; files?: ResultFile[]; loading: boolean }) {
  const toast = useToast();
  if (loading) return <Loading />;
  if (!files?.length)
    return (
      <p className="py-8 text-center text-sm text-ink-3">
        No files yet — results and logs land here when the run reaches a terminal state.
      </p>
    );
  const download = async (f: ResultFile) => {
    try {
      const url = await fileDownloadUrl(jobId, f.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast('error', errorText(e, 'Download failed'));
    }
  };
  return (
    <div className="border border-seam bg-paper">
      <table className="w-full text-sm">
        <thead>
          <tr className="font-condensed border-b border-seam text-left text-[11px] tracking-[0.12em] text-ink-3 uppercase">
            <th className="px-4 py-2 font-bold">File</th>
            <th className="px-4 py-2 font-bold">Type</th>
            <th className="px-4 py-2 text-right font-bold">Size</th>
            <th className="px-4 py-2 text-right font-bold">Added</th>
            <th className="w-10 px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.id} className="border-b border-seam last:border-0 hover:bg-ground/60">
              <td className="font-mono px-4 py-2 text-[13px]">
                <span className="flex items-center gap-2">
                  <FileText size={13} className="text-ink-3" /> {f.filename}
                </span>
              </td>
              <td className="px-4 py-2 text-ink-2">{f.file_type.replace(/_/g, ' ')}</td>
              <td className="font-mono tnum px-4 py-2 text-right text-[13px]">{formatBytes(f.file_size)}</td>
              <td className="px-4 py-2 text-right text-ink-3">{formatDate(f.created_at)}</td>
              <td className="px-4 py-2 text-right">
                <button
                  aria-label={`Download ${f.filename}`}
                  className="cursor-pointer p-1 text-ink-3 hover:text-race"
                  onClick={() => download(f)}
                >
                  <Download size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigTab({ job, canTemplate }: { job: import('../types').Job; canTemplate: boolean }) {
  const [showJson, setShowJson] = useState(false);
  const templates = useTemplateMutations();
  const toast = useToast();
  const c = job.config;
  if (!c) return <p className="py-8 text-center text-sm text-ink-3">No stored configuration.</p>;
  const s = c.solver;
  const rows: [string, string][] = [
    ['Profile', c.cfd_mode === 'full_car' ? 'Full car' : 'Individual part'],
    ['Mesh workflow', c.mesh?.workflow ?? '—'],
    ['Turbulence', `${s.turbulence.model}${s.turbulence.curvature_correction ? ' + curvature correction' : ''}`],
    ['Freestream', `${s.boundary_conditions.velocity_inlets[0]?.velocity ?? '—'} m/s`],
    ['Iterations', String(s.convergence.max_iterations)],
    [
      'Reference values',
      `A ${s.reference_values.area_m2} m² · L ${s.reference_values.length_m} m · V ${s.reference_values.velocity_mps} m/s · ρ ${s.reference_values.density_kg_m3}`,
    ],
    ['Symmetry', s.symmetry.half_model ? `half model · forces ×${s.symmetry.force_factor}` : 'full model'],
    ['Force scope', String(s.reporting.body_wall_pattern)],
    [
      'Resources',
      `${c.slurm.nodes}×${c.slurm.cores_per_node} cores · ${c.slurm.memory_gb} GB · ${c.slurm.walltime_hours} h · ${c.slurm.partition}`,
    ],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="border border-seam bg-paper">
        <dl className="divide-y divide-seam">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-4 px-4 py-2.5">
              <dt className="font-condensed w-44 shrink-0 text-[11px] leading-5 font-bold tracking-[0.12em] text-ink-3 uppercase">
                {k}
              </dt>
              <dd className="font-mono tnum text-[13px]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex items-center gap-2">
        {canTemplate && (
          <Button
            onClick={() =>
              templates.create
                .mutateAsync({
                  name: `${job.name} template`,
                  description: `Saved from run ${job.name}`,
                  config: c as unknown as Record<string, unknown>,
                })
                .then(() => toast('ok', 'Saved as template'))
                .catch((e) => toast('error', errorText(e)))
            }
            busy={templates.create.isPending}
          >
            Save as template
          </Button>
        )}
        <Button variant="ghost" onClick={() => setShowJson((v) => !v)}>
          {showJson ? 'Hide raw JSON' : 'Show raw JSON'}
        </Button>
      </div>
      {showJson && (
        <pre className="font-mono max-h-96 overflow-auto border border-seam bg-ink p-4 text-[12px] leading-relaxed text-[#d6d9e0]">
          {JSON.stringify(c, null, 2)}
        </pre>
      )}
    </div>
  );
}
