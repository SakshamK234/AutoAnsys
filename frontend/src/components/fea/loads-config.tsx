import { Plus, X } from 'lucide-react';
import { LOAD_LABELS } from '@/lib/fea-constants';
import type { FEALoad, LoadType } from '@/types/fea';

interface LoadsConfigProps {
  loads: FEALoad[];
  onChange: (loads: FEALoad[]) => void;
}

const TYPES: LoadType[] = ['force', 'pressure', 'gravity', 'displacement'];

export function LoadsConfig({ loads, onChange }: LoadsConfigProps) {
  const add = () => {
    onChange([
      ...loads,
      {
        id: crypto.randomUUID(),
        type: 'force',
        face_ids: [],
        magnitude: 0,
        direction: { x: 0, y: -1, z: 0 },
      },
    ]);
  };

  const remove = (id: string) => {
    if (loads.length <= 1) return;
    onChange(loads.filter((l) => l.id !== id));
  };

  const update = (id: string, patch: Partial<FEALoad>) => {
    onChange(loads.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const showFaceIds = (type: LoadType) => type !== 'gravity';
  const showMagnitude = (type: LoadType) => type === 'force' || type === 'pressure' || type === 'gravity';
  const showDirection = (type: LoadType) => type === 'force' || type === 'gravity';
  const showDisplacement = (type: LoadType) => type === 'displacement';

  const magnitudeUnit = (type: LoadType) => {
    if (type === 'force') return 'N';
    if (type === 'pressure') return 'Pa';
    if (type === 'gravity') return 'm/s²';
    return '';
  };

  return (
    <div className="space-y-3">
      {loads.length === 0 && (
        <p className="text-xs text-rose-500">At least one load is required.</p>
      )}
      {loads.map((ld) => (
        <div
          key={ld.id}
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Type</label>
                <select
                  value={ld.type}
                  onChange={(e) => {
                    const newType = e.target.value as LoadType;
                    const patch: Partial<FEALoad> = { type: newType };
                    if (newType === 'force') {
                      patch.direction = ld.direction ?? { x: 0, y: -1, z: 0 };
                      patch.magnitude = ld.magnitude ?? 0;
                      patch.displacement = undefined;
                      patch.g = undefined;
                    } else if (newType === 'pressure') {
                      patch.magnitude = ld.magnitude ?? 0;
                      patch.direction = undefined;
                      patch.displacement = undefined;
                      patch.g = undefined;
                    } else if (newType === 'gravity') {
                      patch.direction = { x: 0, y: -1, z: 0 };
                      patch.g = 9.81;
                      patch.face_ids = undefined;
                      patch.displacement = undefined;
                    } else if (newType === 'displacement') {
                      patch.displacement = { x: null, y: null, z: null };
                      patch.direction = undefined;
                      patch.magnitude = undefined;
                      patch.g = undefined;
                    }
                    update(ld.id, patch);
                  }}
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{LOAD_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {showFaceIds(ld.type) && (
                <div>
                  <label className="block text-xs font-medium mb-1">Face IDs</label>
                  <input
                    type="text"
                    value={(ld.face_ids ?? []).join(', ')}
                    onChange={(e) =>
                      update(ld.id, {
                        face_ids: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="face_2, face_6"
                    className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => remove(ld.id)}
              disabled={loads.length <= 1}
              className="mt-5 rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-30 transition-colors"
              title="Remove load"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {showMagnitude(ld.type) && (
            <div className="w-48">
              <label className="block text-xs font-medium mb-1">
                {ld.type === 'gravity' ? 'g' : 'Magnitude'} ({magnitudeUnit(ld.type)})
              </label>
              <input
                type="number"
                step="any"
                value={ld.type === 'gravity' ? (ld.g ?? 9.81) : (ld.magnitude ?? '')}
                onChange={(e) => {
                  if (ld.type === 'gravity') {
                    update(ld.id, { g: +e.target.value });
                  } else {
                    update(ld.id, { magnitude: +e.target.value });
                  }
                }}
                className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                placeholder={ld.type === 'gravity' ? '9.81' : '0'}
              />
            </div>
          )}

          {showDirection(ld.type) && (
            <div>
              <label className="block text-xs font-medium mb-1">Direction (X, Y, Z)</label>
              <div className="grid grid-cols-3 gap-3">
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <input
                    key={axis}
                    type="number"
                    step="any"
                    value={ld.direction?.[axis] ?? 0}
                    onChange={(e) => {
                      const dir = { ...(ld.direction ?? { x: 0, y: 0, z: 0 }) };
                      dir[axis] = +e.target.value;
                      update(ld.id, { direction: dir });
                    }}
                    placeholder={axis.toUpperCase()}
                    className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                  />
                ))}
              </div>
            </div>
          )}

          {showDisplacement(ld.type) && (
            <div className="grid grid-cols-3 gap-3">
              {(['x', 'y', 'z'] as const).map((axis) => {
                const isFree = ld.displacement?.[axis] === null;
                return (
                  <div key={axis}>
                    <label className="block text-xs font-medium mb-1 uppercase">{axis} (mm)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.001"
                        disabled={isFree}
                        value={isFree ? '' : (ld.displacement?.[axis] ?? '')}
                        onChange={(e) => {
                          const disp = { ...(ld.displacement || { x: null, y: null, z: null }) };
                          disp[axis] = +e.target.value / 1000;
                          update(ld.id, { displacement: disp });
                        }}
                        className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm disabled:opacity-40"
                        placeholder={isFree ? 'free' : '0'}
                      />
                      <label className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isFree}
                          onChange={(e) => {
                            const disp = { ...(ld.displacement || { x: null, y: null, z: null }) };
                            disp[axis] = e.target.checked ? null : 0;
                            update(ld.id, { displacement: disp });
                          }}
                          className="rounded"
                        />
                        Free
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={add}
        className="flex items-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary))] transition-colors w-full justify-center"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Load
      </button>
    </div>
  );
}
