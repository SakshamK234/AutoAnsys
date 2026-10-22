import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ForcePoint, ResidualPoint } from '../types';

const AXIS = { stroke: '#80848f', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' };
const GRID = '#e7e7e0';

const RESIDUAL_SERIES: { key: keyof ResidualPoint; label: string; color: string }[] = [
  { key: 'continuity', label: 'continuity', color: '#14161b' },
  { key: 'x_velocity', label: 'x-vel', color: '#1d43d8' },
  { key: 'y_velocity', label: 'y-vel', color: '#0e8fb8' },
  { key: 'z_velocity', label: 'z-vel', color: '#0a8f6a' },
  { key: 'k', label: 'k', color: '#e8a013' },
  { key: 'omega', label: 'omega', color: '#7a2fd0' },
];

function mergeSeries<T extends { iteration: number }>(base: T[], live: T[]): T[] {
  if (!live.length) return base;
  if (!base.length) return live;
  const lastBase = base[base.length - 1].iteration;
  return [...base, ...live.filter((p) => p.iteration > lastBase)];
}

const logTick = (v: number) => {
  const exp = Math.round(Math.log10(v));
  return `1e${exp}`;
};

export function ResidualChart({
  data,
  live = [],
  target,
}: {
  data: ResidualPoint[];
  live?: ResidualPoint[];
  target?: number;
}) {
  const merged = useMemo(() => mergeSeries(data, live), [data, live]);
  if (!merged.length) return null;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={merged} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="iteration" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis
          scale="log"
          domain={['auto', 'auto']}
          tick={AXIS}
          tickFormatter={logTick}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          formatter={(v) => (typeof v === 'number' ? v.toExponential(2) : String(v))}
          labelFormatter={(l) => `iteration ${l}`}
          contentStyle={{
            border: '1px solid #dcdcd4',
            borderRadius: 3,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Archivo, sans-serif' }} />
        {target && (
          <ReferenceArea y1={0} y2={target} fill="#097a49" fillOpacity={0.05} strokeOpacity={0} />
        )}
        {RESIDUAL_SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            dot={false}
            strokeWidth={s.key === 'continuity' ? 2 : 1.25}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

const FORCE_SERIES: { key: keyof ForcePoint; label: string; color: string }[] = [
  { key: 'cd', label: 'Cd', color: '#d92d20' },
  { key: 'cl', label: 'Cl', color: '#1d43d8' },
  { key: 'cm', label: 'Cm', color: '#0a8f6a' },
];

export function ForceChart({
  data,
  live = [],
  plateauWindow = 50,
}: {
  data: ForcePoint[];
  live?: ForcePoint[];
  plateauWindow?: number;
}) {
  const merged = useMemo(() => mergeSeries(data, live), [data, live]);
  if (!merged.length) return null;
  const last = merged[merged.length - 1].iteration;
  const windowStart = Math.max(merged[0].iteration, last - plateauWindow);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={merged} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="iteration" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis
          tick={AXIS}
          tickFormatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          formatter={(v) => (typeof v === 'number' ? v.toFixed(4) : String(v))}
          labelFormatter={(l) => `iteration ${l}`}
          contentStyle={{
            border: '1px solid #dcdcd4',
            borderRadius: 3,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Archivo, sans-serif' }} />
        {/* Plateau window the verdict averages over. */}
        <ReferenceArea x1={windowStart} x2={last} fill="#1d43d8" fillOpacity={0.05} strokeOpacity={0} />
        {FORCE_SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
