import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import type { JobStatus } from '../types';
import { carNumber, liveryBands } from '../lib/livery';

/* ── Stripe: the three-band livery mark that identifies a run ─────────── */

export function Stripe({ id, className }: { id: string; className?: string }) {
  const [a, b, c] = liveryBands(id);
  return (
    <span className={clsx('flex w-[14px] shrink-0 flex-col self-stretch', className)} aria-hidden>
      <span className="flex-[3]" style={{ background: a }} />
      <span className="flex-[2]" style={{ background: b }} />
      <span className="flex-[1]" style={{ background: c }} />
    </span>
  );
}

/* ── Roundel: racing car number ──────────────────────────────────────── */

export function Roundel({ id, size = 34 }: { id: string; size?: number }) {
  return (
    <span
      className="font-condensed tnum flex shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper font-bold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {carNumber(id)}
    </span>
  );
}

/* ── Status chip ─────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<string, { label: string; cls: string; dot?: string }> = {
  draft: { label: 'Draft', cls: 'bg-ground text-ink-2 border-seam-strong' },
  queued: { label: 'In queue', cls: 'bg-warn-tint text-warn border-warn/30' },
  running: { label: 'On track', cls: 'bg-race-tint text-race-deep border-race/30', dot: 'bg-race' },
  completed: { label: 'Finished', cls: 'bg-ok-tint text-ok border-ok/30' },
  failed: { label: 'Failed', cls: 'bg-crit-tint text-crit border-crit/30' },
  cancelled: { label: 'Cancelled', cls: 'bg-ground text-ink-3 border-seam-strong' },
};

export function StatusChip({ status }: { status: JobStatus | string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.draft;
  return (
    <span
      className={clsx(
        'font-condensed inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 text-[11px] font-bold tracking-[0.1em] uppercase',
        s.cls,
      )}
    >
      {s.dot && <span className={clsx('live-dot h-1.5 w-1.5 rounded-full', s.dot)} />}
      {s.label}
    </span>
  );
}

/* ── Stamp: angled terminal verdict (ticket-wallet raise) ────────────── */

export function Stamp({ status }: { status: JobStatus | string }) {
  const map: Record<string, { text: string; cls: string }> = {
    completed: { text: 'Finished', cls: 'text-ok' },
    failed: { text: 'Failed', cls: 'text-crit' },
    cancelled: { text: 'Cancelled', cls: 'text-ink-3' },
  };
  const s = map[status];
  if (!s) return null;
  return <span className={clsx('stamp', s.cls)}>{s.text}</span>;
}

/* ── Plate: bordered figure with caption (lexicon raise) ─────────────── */

export function Plate({
  caption,
  children,
  className,
  actions,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <figure className={clsx('border border-seam bg-paper', className)}>
      <figcaption className="flex items-center justify-between border-b border-seam px-4 py-2">
        <span className="font-condensed text-[11px] font-bold tracking-[0.14em] text-ink-2 uppercase">
          {caption}
        </span>
        {actions}
      </figcaption>
      <div className="p-4">{children}</div>
    </figure>
  );
}

/* ── Stat tile ───────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'ok' | 'crit' | 'race';
}) {
  return (
    <div className="border border-seam bg-paper px-4 py-3">
      <p className="font-condensed text-[11px] font-bold tracking-[0.14em] text-ink-3 uppercase">{label}</p>
      <p
        className={clsx(
          'font-mono tnum mt-1 text-[26px] leading-none font-semibold',
          tone === 'ok' && 'text-ok',
          tone === 'crit' && 'text-crit',
          tone === 'race' && 'text-race-deep',
          !tone && 'text-ink',
        )}
      >
        {value}
        {unit && <span className="ml-1 text-[13px] font-medium text-ink-3">{unit}</span>}
      </p>
    </div>
  );
}
