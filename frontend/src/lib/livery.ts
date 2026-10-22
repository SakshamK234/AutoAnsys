/** The livery system: every run/mesh gets a deterministic identity from its
 * id — a car number and a three-band stripe drawn from the series palette.
 * The same hues key chart series and compare chips, so one iteration is
 * recognizable across every surface. */

export const SERIES = [
  'var(--color-livery-1)',
  'var(--color-livery-2)',
  'var(--color-livery-3)',
  'var(--color-livery-4)',
  'var(--color-livery-5)',
  'var(--color-livery-6)',
] as const;

/** Raw hex values for places that can't resolve CSS vars (SVG exports). */
export const SERIES_HEX = ['#1d43d8', '#d92d20', '#0a8f6a', '#e8a013', '#7a2fd0', '#0e8fb8'] as const;

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Three-band livery stripe for an entity id. Bands are distinct hues. */
export function liveryBands(id: string): [string, string, string] {
  const h = hash(id);
  const a = h % SERIES.length;
  const b = (a + 1 + ((h >> 8) % (SERIES.length - 1))) % SERIES.length;
  let c = (b + 1 + ((h >> 16) % (SERIES.length - 1))) % SERIES.length;
  if (c === a) c = (c + 1) % SERIES.length;
  return [SERIES[a], SERIES[b], SERIES[c]];
}

/** Primary identity hue for charts/chips. */
export function liveryColor(id: string): string {
  return SERIES[hash(id) % SERIES.length];
}
export function liveryHex(id: string): string {
  return SERIES_HEX[hash(id) % SERIES_HEX.length];
}

/** Car number: stable 2-digit number from the id (01–99). */
export function carNumber(id: string): string {
  return String((hash(id) % 99) + 1).padStart(2, '0');
}
