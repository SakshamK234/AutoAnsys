import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { X } from 'lucide-react';
import api from '../lib/api';
import { useJobs } from '../lib/queries';
import { liveryHex, carNumber } from '../lib/livery';
import { formatCoeff, formatForce } from '../lib/format';
import { PageHeader } from '../components/chrome';
import { EmptyState, Loading, Select, Tabs } from '../components/ui';
import { Plate } from '../components/livery';
import { plateauStats } from '../lib/plateau';
import type { ForcePoint, Job, ResidualPoint } from '../types';

interface CompareEntry {
  job: Job;
  forces: ForcePoint[];
  residuals: ResidualPoint[];
}

const AXIS = { stroke: '#80848f', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' };

export default function ComparePage() {
  const [ids, setIds] = useState<string[]>([]);
  const completed = useJobs({ status: 'completed', limit: 100 });
  const [tab, setTab] = useState('forces');
  const [metric, setMetric] = useState<'cd' | 'cl' | 'cm'>('cd');

  const compare = useQuery({
    queryKey: ['compare', ids],
    queryFn: async () => (await api.get<CompareEntry[]>(`/jobs/compare/data?ids=${ids.join(',')}`)).data,
    enabled: ids.length >= 2,
  });

  // One color per selected run, keyed by its livery hue so identity matches
  // everywhere else in the app.
  const entries = useMemo(() => compare.data ?? [], [compare.data]);
  const colorOf = (id: string) => liveryHex(id);

  const forceSeries = useMemo(() => mergeByIteration(entries, (e) => e.forces, metric), [entries, metric]);
  const residualSeries = useMemo(
    () => mergeByIteration(entries, (e) => e.residuals, 'continuity'),
    [entries],
  );

  const addable = completed.data?.items.filter((j) => !ids.includes(j.id)) ?? [];

  return (
    <div className="settle">
      <PageHeader title="Compare runs" sub="Overlay 2–6 finished runs — same stripe colors as everywhere else." />

      {/* Selector */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {ids.map((id) => {
          const j = completed.data?.items.find((x) => x.id === id) ?? entries.find((e) => e.job.id === id)?.job;
          return (
            <span key={id} className="flex items-stretch border border-seam bg-paper text-sm">
              <span className="w-1.5 shrink-0" style={{ background: colorOf(id) }} aria-hidden />
              <span className="flex items-center gap-2 py-1 pr-2 pl-2">
              <span className="font-mono tnum text-xs text-ink-3">#{carNumber(id)}</span>
              <span className="max-w-44 truncate font-medium">{j?.name ?? id.slice(0, 8)}</span>
              <button
                aria-label="Remove from comparison"
                className="cursor-pointer text-ink-3 hover:text-crit"
                onClick={() => setIds((v) => v.filter((x) => x !== id))}
              >
                <X size={13} />
              </button>
              </span>
            </span>
          );
        })}
        {ids.length < 6 && (
          <Select
            value=""
            onChange={(e) => e.target.value && setIds((v) => [...v, e.target.value])}
            className="w-64"
            aria-label="Add run to comparison"
          >
            <option value="">+ Add a finished run…</option>
            {addable.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {ids.length < 2 ? (
        <EmptyState
          title="Pick at least two runs"
          detail="Verdicts, force curves, residuals, and setup differences line up side by side."
        />
      ) : compare.isLoading ? (
        <Loading label="Loading comparison" />
      ) : entries.length < 2 ? (
        <EmptyState title="Not enough accessible runs" detail="You can only compare runs you own or that are shared with your team." />
      ) : (
        <>
          {/* Verdict table */}
          <div className="mb-6 overflow-x-auto border border-seam bg-paper">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="font-condensed border-b border-seam text-left text-[11px] tracking-[0.12em] text-ink-3 uppercase">
                  <th className="px-4 py-2 font-bold">Run</th>
                  <th className="px-4 py-2 text-right font-bold">Cd</th>
                  <th className="px-4 py-2 text-right font-bold">Cl</th>
                  <th className="px-4 py-2 text-right font-bold">Cm</th>
                  <th className="px-4 py-2 text-right font-bold">Drag</th>
                  <th className="px-4 py-2 text-right font-bold">Downforce</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const s = plateauStats(e.forces);
                  return (
                    <tr key={e.job.id} className="border-b border-seam last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="h-5 w-2" style={{ background: colorOf(e.job.id) }} aria-hidden />
                          <Link to={`/runs/${e.job.id}`} className="font-medium hover:text-race-deep hover:underline">
                            {e.job.name}
                          </Link>
                        </span>
                      </td>
                      <td className="font-mono tnum px-4 py-2.5 text-right font-semibold">{formatCoeff(s?.cd)}</td>
                      <td className="font-mono tnum px-4 py-2.5 text-right font-semibold">{formatCoeff(s?.cl, true)}</td>
                      <td className="font-mono tnum px-4 py-2.5 text-right">{formatCoeff(s?.cm, true)}</td>
                      <td className="font-mono tnum px-4 py-2.5 text-right">{formatForce(s?.dragN)}</td>
                      <td className="font-mono tnum px-4 py-2.5 text-right">
                        {s ? formatForce(-s.liftN) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'forces', label: 'Force history' },
              { value: 'residuals', label: 'Residuals' },
              { value: 'config', label: 'Setup diff' },
            ]}
          />
          <div className="mt-4">
            {tab === 'forces' && (
              <Plate
                caption={`Fig. — ${metric.toUpperCase()} vs iteration`}
                actions={
                  <div className="flex gap-1">
                    {(['cd', 'cl', 'cm'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetric(m)}
                        className={`font-condensed cursor-pointer rounded-[3px] px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] uppercase ${
                          metric === m ? 'bg-ink text-white' : 'text-ink-3 hover:text-ink'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                }
              >
                <OverlayChart data={forceSeries} entries={entries} colorOf={colorOf} />
              </Plate>
            )}
            {tab === 'residuals' && (
              <Plate caption="Fig. — Continuity residual (log scale)">
                <OverlayChart data={residualSeries} entries={entries} colorOf={colorOf} log />
              </Plate>
            )}
            {tab === 'config' && <ConfigDiff entries={entries} colorOf={colorOf} />}
          </div>
        </>
      )}
    </div>
  );
}

/** Build rows {iteration, [jobId]: value} for an overlay chart. */
function mergeByIteration(
  entries: CompareEntry[],
  pick: (e: CompareEntry) => ReadonlyArray<object>,
  key: string,
): Array<Record<string, number>> {
  const byIter = new Map<number, Record<string, number>>();
  for (const e of entries) {
    for (const raw of pick(e)) {
      const p = raw as Record<string, number>;
      const it = p.iteration;
      const row = byIter.get(it) ?? { iteration: it };
      row[e.job.id] = p[key];
      byIter.set(it, row);
    }
  }
  return [...byIter.values()].sort((a, b) => a.iteration - b.iteration);
}

function OverlayChart({
  data,
  entries,
  colorOf,
  log = false,
}: {
  data: Array<Record<string, number>>;
  entries: CompareEntry[];
  colorOf: (id: string) => string;
  log?: boolean;
}) {
  if (!data.length) return <p className="py-10 text-center text-sm text-ink-3">No data for these runs.</p>;
  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="#e7e7e0" vertical={false} />
        <XAxis dataKey="iteration" tick={AXIS} tickLine={false} axisLine={{ stroke: '#e7e7e0' }} />
        <YAxis
          scale={log ? 'log' : 'auto'}
          domain={log ? ['auto', 'auto'] : undefined}
          tick={AXIS}
          tickFormatter={(v) => (log ? `1e${Math.round(Math.log10(v))}` : typeof v === 'number' ? v.toFixed(2) : String(v))}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          formatter={(v, name) => [
            typeof v === 'number' ? (log ? v.toExponential(2) : v.toFixed(4)) : String(v),
            entries.find((e) => e.job.id === name)?.job.name ?? String(name),
          ]}
          labelFormatter={(l) => `iteration ${l}`}
          contentStyle={{ border: '1px solid #dcdcd4', borderRadius: 3, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
        />
        <Legend
          formatter={(value) => entries.find((e) => e.job.id === value)?.job.name ?? value}
          wrapperStyle={{ fontSize: 11, fontFamily: 'Archivo, sans-serif' }}
        />
        {entries.map((e) => (
          <Line
            key={e.job.id}
            dataKey={e.job.id}
            stroke={colorOf(e.job.id)}
            dot={false}
            strokeWidth={1.75}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Flatten configs and show only rows where runs differ. */
function ConfigDiff({ entries, colorOf }: { entries: CompareEntry[]; colorOf: (id: string) => string }) {
  const flats = entries.map((e) => flatten((e.job.config ?? {}) as Record<string, unknown>));
  const keys = [...new Set(flats.flatMap((f) => Object.keys(f)))].sort();
  const differing = keys.filter((k) => {
    const vals = flats.map((f) => JSON.stringify(f[k]));
    return new Set(vals).size > 1;
  });
  if (!differing.length)
    return <p className="py-8 text-center text-sm text-ink-3">These runs share an identical setup.</p>;
  return (
    <div className="overflow-x-auto border border-seam bg-paper">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="font-condensed border-b border-seam text-left text-[11px] tracking-[0.12em] text-ink-3 uppercase">
            <th className="px-4 py-2 font-bold">Setting</th>
            {entries.map((e) => (
              <th key={e.job.id} className="px-4 py-2 font-bold">
                <span className="flex items-center gap-1.5 normal-case">
                  <span className="h-3 w-1.5" style={{ background: colorOf(e.job.id) }} aria-hidden />
                  {e.job.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {differing.map((k) => (
            <tr key={k} className="border-b border-seam last:border-0">
              <td className="font-mono px-4 py-2 text-[12px] text-ink-2">{k}</td>
              {flats.map((f, i) => (
                <td key={i} className="font-mono tnum px-4 py-2 text-[12px] font-semibold">
                  {f[k] === undefined ? '—' : String(f[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v as Record<string, unknown>, key));
    else if (Array.isArray(v)) out[key] = JSON.stringify(v);
    else out[key] = v;
  }
  return out;
}
