import { Plus, X } from 'lucide-react';
import { CONSTRAINT_LABELS } from '@/lib/fea-constants';
import type { FEAConstraint, ConstraintType, AnalysisAxis, SymmetryPlane } from '@/types/fea';

interface ConstraintsConfigProps {
  constraints: FEAConstraint[];
  onChange: (constraints: FEAConstraint[]) => void;
}

const TYPES: ConstraintType[] = ['fixed', 'pinned', 'roller', 'symmetry', 'displacement'];
const AXES: AnalysisAxis[] = ['X', 'Y', 'Z'];
const PLANES: SymmetryPlane[] = ['XY', 'YZ', 'XZ'];

export function ConstraintsConfig({ constraints, onChange }: ConstraintsConfigProps) {
  const add = () => {
    onChange([
      ...constraints,
      {
        id: crypto.randomUUID(),
        type: 'fixed',
        face_ids: [],
      },
    ]);
  };

  const remove = (id: string) => {
    if (constraints.length <= 1) return;
    onChange(constraints.filter((c) => c.id !== id));
  };

  const update = (id: string, patch: Partial<FEAConstraint>) => {
    onChange(constraints.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  return (
    <div className="space-y-3">
      {constraints.length === 0 && (
        <p className="text-xs text-rose-500">At least one constraint is required.</p>
      )}
      {constraints.map((bc) => (
        <div
          key={bc.id}
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Type</label>
                <select
                  value={bc.type}
                  onChange={(e) => {
                    const newType = e.target.value as ConstraintType;
                    const patch: Partial<FEAConstraint> = { type: newType };
                    if (newType !== 'roller') patch.axis = undefined;
                    if (newType !== 'symmetry') patch.plane = undefined;
                    if (newType !== 'displacement') patch.displacement = undefined;
                    if (newType === 'displacement') {
                      patch.displacement = { x: null, y: null, z: null };
                    }
                    update(bc.id, patch);
                  }}
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{CONSTRAINT_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Face IDs</label>
                <input
                  type="text"
                  value={bc.face_ids.join(', ')}
                  onChange={(e) =>
                    update(bc.id, {
                      face_ids: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="face_1, face_3"
                  className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => remove(bc.id)}
              disabled={constraints.length <= 1}
              className="mt-5 rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-30 transition-colors"
              title="Remove constraint"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {bc.type === 'roller' && (
            <div className="w-32">
              <label className="block text-xs font-medium mb-1">Blocked Axis</label>
              <select
                value={bc.axis || 'Y'}
                onChange={(e) => update(bc.id, { axis: e.target.value as AnalysisAxis })}
                className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
              >
                {AXES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

          {bc.type === 'symmetry' && (
            <div className="w-32">
              <label className="block text-xs font-medium mb-1">Symmetry Plane</label>
              <select
                value={bc.plane || 'XZ'}
                onChange={(e) => update(bc.id, { plane: e.target.value as SymmetryPlane })}
                className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
              >
                {PLANES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}

          {bc.type === 'displacement' && (
            <div className="grid grid-cols-3 gap-3">
              {(['x', 'y', 'z'] as const).map((axis) => {
                const isFree = bc.displacement?.[axis] === null;
                return (
                  <div key={axis}>
                    <label className="block text-xs font-medium mb-1 uppercase">{axis} (mm)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.001"
                        disabled={isFree}
                        value={isFree ? '' : (bc.displacement?.[axis] ?? '')}
                        onChange={(e) => {
                          const disp = { ...(bc.displacement || { x: null, y: null, z: null }) };
                          disp[axis] = +e.target.value / 1000;
                          update(bc.id, { displacement: disp });
                        }}
                        className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm disabled:opacity-40"
                        placeholder={isFree ? 'free' : '0'}
                      />
                      <label className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isFree}
                          onChange={(e) => {
                            const disp = { ...(bc.displacement || { x: null, y: null, z: null }) };
                            disp[axis] = e.target.checked ? null : 0;
                            update(bc.id, { displacement: disp });
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
        Add Constraint
      </button>
    </div>
  );
}
