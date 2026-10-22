/** Formatting helpers. The backend serializes naive-UTC timestamps without a
 * trailing Z — parse them as UTC, never as local time. */

export function parseUTC(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /Z|[+-]\d{2}:?\d{2}$/.test(value);
  const d = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | null | undefined): string {
  const d = parseUTC(value);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAgo(value: string | null | undefined): string {
  const d = parseUTC(value);
  if (!d) return '—';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** file_size arrives in BYTES. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = -1;
  do {
    v /= 1024;
    i += 1;
  } while (v >= 1024 && i < units.length - 1);
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export function formatDuration(start: string | null | undefined, end: string | null | undefined): string {
  const a = parseUTC(start);
  const b = parseUTC(end) ?? new Date();
  if (!a) return '—';
  const s = Math.max(0, (b.getTime() - a.getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${Math.floor(s % 60).toString().padStart(2, '0')}s`;
  return `${Math.floor(s)}s`;
}

export function formatCells(count: number | null | undefined): string {
  if (count == null) return '—';
  if (count >= 1e6) return `${(count / 1e6).toFixed(2)} M`;
  if (count >= 1e3) return `${(count / 1e3).toFixed(0)} k`;
  return String(count);
}

/** Aero coefficient: fixed 3 decimals, explicit sign for lift/moment. */
export function formatCoeff(v: number | null | undefined, signed = false): string {
  if (v == null || Number.isNaN(v)) return '—';
  const s = v.toFixed(3);
  return signed && v > 0 ? `+${s}` : s;
}

export function formatForce(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1)} N`;
}
