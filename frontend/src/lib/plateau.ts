import type { ForcePoint } from '../types';

/** Mean + spread over the last N iterations — the verdict numbers. */
export function plateauStats(data: ForcePoint[], window = 50) {
  if (!data.length) return null;
  const tail = data.slice(-window);
  const mean = (k: keyof ForcePoint) => tail.reduce((a, p) => a + (p[k] as number), 0) / tail.length;
  const spread = (k: keyof ForcePoint, m: number) =>
    Math.sqrt(tail.reduce((a, p) => a + ((p[k] as number) - m) ** 2, 0) / tail.length);
  const cd = mean('cd');
  const cl = mean('cl');
  const cm = mean('cm');
  return {
    n: tail.length,
    cd,
    cl,
    cm,
    cdSigma: spread('cd', cd),
    clSigma: spread('cl', cl),
    dragN: mean('drag_n'),
    liftN: mean('lift_n'),
    momentNm: mean('moment_nm'),
    converged: tail.length >= Math.min(window, 20) && spread('cd', cd) < Math.max(0.005, Math.abs(cd) * 0.01),
  };
}
