import { cn } from '@/lib/utils';

/** F1 start-light strip mapping a job's pipeline stages.
 *  Lights fill green as stages complete; the active stage pulses orange;
 *  a failure locks its light red. */
export interface Stage {
  key: string;
  label: string;
}

export const JOB_STAGES: Stage[] = [
  { key: 'import', label: 'Import' },
  { key: 'mesh', label: 'Mesh' },
  { key: 'boundaries', label: 'Zones' },
  { key: 'solve', label: 'Solve' },
  { key: 'post', label: 'Post' },
];

export function StageLights({
  stages = JOB_STAGES,
  activeIndex,
  failed = false,
  className,
  compact = false,
}: {
  stages?: Stage[];
  /** index of the stage currently running; stages before it are done.
   *  Pass stages.length when everything is complete. */
  activeIndex: number;
  failed?: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex items-end gap-3', className)} role="img"
      aria-label={failed ? `Failed during ${stages[Math.min(activeIndex, stages.length - 1)]?.label}` : `Stage ${Math.min(activeIndex + 1, stages.length)} of ${stages.length}`}>
      {stages.map((stage, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex && !done;
        return (
          <div key={stage.key} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'stage-light',
                done && 'stage-light--done',
                active && !failed && 'stage-light--active',
                active && failed && 'stage-light--failed'
              )}
            />
            {!compact && (
              <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {stage.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
