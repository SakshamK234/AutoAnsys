import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import type { JobProgress, JobStatus } from '../types';

/** Coarse pipeline stages, derived from the journal's *_DONE markers that the
 * backend tails out of fluent.log. Order matters. */
const STAGES = [
  {
    key: 'import',
    label: 'Import',
    markers: ['IMPORT_DONE', 'DGF_DONE', 'DELETE_BODIES_DONE', 'SHELL_SPLIT_DONE'],
  },
  {
    key: 'domain',
    label: 'Domain',
    markers: ['CEFB_DONE', 'IDREG_DONE', 'URS_DONE', 'SCOPED_SIZING_DONE', 'CMCO_DONE', 'SIZING_DONE'],
  },
  {
    key: 'mesh',
    label: 'Mesh',
    markers: ['SURF_DONE', 'REGIONS_DONE', 'PRISMS_DONE', 'VOLUME_DONE'],
  },
  {
    key: 'zones',
    label: 'Zones',
    markers: ['CLASSIFY_BEGIN', 'CLASSIFIER_DONE', 'CARVE_DONE', 'ASSIGN_LOADED', 'ZONE_TYPES_PINNED', 'MESH_WRITTEN', 'CASE_LOADED'],
  },
  {
    key: 'solve',
    label: 'Solve',
    markers: ['SOLVE_BEGIN', 'COMBINED_SOLVE_COMPLETE', 'SOLVE_COMPLETE'],
  },
  { key: 'post', label: 'Post', markers: ['CONTOURS_DONE'] },
] as const;

function stageIndex(marker: string | null | undefined, iteration?: number | null): number {
  if (iteration != null && iteration > 0) return 4; // solving
  if (!marker) return -1;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if ((STAGES[i].markers as readonly string[]).includes(marker)) return i;
  }
  return -1;
}

export function StageProgress({
  progress,
  status,
  compact = false,
}: {
  progress: JobProgress | null | undefined;
  status: JobStatus;
  compact?: boolean;
}) {
  const terminalDone = status === 'completed';
  const idx = terminalDone ? STAGES.length : stageIndex(progress?.marker, progress?.iteration);
  const iteration = progress?.iteration ?? null;
  const maxIter = progress?.max_iterations ?? null;

  if (status === 'queued') {
    return (
      <p className="font-condensed text-[11px] font-bold tracking-[0.12em] text-warn uppercase">
        Waiting for cluster resources
      </p>
    );
  }

  return (
    <div className={clsx('flex flex-col', compact ? 'gap-1' : 'gap-2')}>
      <ol className="flex items-center gap-1" aria-label="Run stages">
        {STAGES.map((s, i) => {
          const done = i < idx;
          const current = i === idx && status === 'running';
          return (
            <li key={s.key} className="flex items-center gap-1">
              <span
                className={clsx(
                  'font-condensed flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] uppercase',
                  done && 'border-ok/30 bg-ok-tint text-ok',
                  current && 'border-race/40 bg-race-tint text-race-deep',
                  !done && !current && 'border-seam bg-ground text-ink-3',
                )}
              >
                {done && <Check size={10} strokeWidth={3} />}
                {current && <span className="live-dot h-1.5 w-1.5 rounded-full bg-race" />}
                {s.label}
              </span>
              {i < STAGES.length - 1 && <span className="h-px w-1.5 bg-seam-strong" aria-hidden />}
            </li>
          );
        })}
      </ol>
      {iteration != null && iteration > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-full max-w-64 overflow-hidden rounded-full bg-seam">
            <div
              className="h-full bg-race transition-[width] duration-700"
              style={{
                width: maxIter ? `${Math.min(100, (iteration / maxIter) * 100)}%` : '12%',
              }}
            />
          </div>
          <span className="font-mono tnum text-[11px] text-ink-2">
            iter {iteration}
            {maxIter ? ` / ${maxIter}` : ''}
          </span>
        </div>
      )}
      {!compact && progress?.stage && status === 'running' && (
        <p className="text-xs text-ink-3">{progress.stage}</p>
      )}
    </div>
  );
}
