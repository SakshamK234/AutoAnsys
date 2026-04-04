import { MATERIAL_PRESETS, type MaterialPresetKey } from '@/lib/fea-constants';
import type { FEAMaterial } from '@/types/fea';
import { Info } from 'lucide-react';

interface MaterialConfigProps {
  material: FEAMaterial;
  onChange: (material: FEAMaterial) => void;
}

export function MaterialConfig({ material, onChange }: MaterialConfigProps) {
  const handlePresetChange = (key: string) => {
    if (key === 'custom') {
      onChange({
        preset: 'custom',
        youngs_modulus: 0,
        poissons_ratio: 0.3,
        density: 0,
        yield_strength: null,
      });
      return;
    }
    const p = MATERIAL_PRESETS[key as MaterialPresetKey];
    if (p) {
      onChange({
        preset: key,
        youngs_modulus: p.youngs_modulus ?? 0,
        poissons_ratio: p.poissons_ratio ?? 0.3,
        density: p.density ?? 0,
        yield_strength: p.yield_strength,
      });
    }
  };

  const update = (field: keyof FEAMaterial, value: number | string | null) => {
    onChange({ ...material, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1">Material Preset</label>
        <select
          value={material.preset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
        >
          {Object.entries(MATERIAL_PRESETS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1">Young's Modulus (GPa)</label>
          <input
            type="number"
            step="0.1"
            min={0}
            value={material.youngs_modulus ? +(material.youngs_modulus / 1e9).toFixed(4) : ''}
            onChange={(e) => update('youngs_modulus', +e.target.value * 1e9)}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
            placeholder="e.g. 210"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Poisson's Ratio</label>
          <input
            type="number"
            step="0.01"
            min={0.01}
            max={0.49}
            value={material.poissons_ratio || ''}
            onChange={(e) => update('poissons_ratio', +e.target.value)}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
            placeholder="e.g. 0.3"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Density (kg/m³)</label>
          <input
            type="number"
            step="1"
            min={0}
            value={material.density || ''}
            onChange={(e) => update('density', +e.target.value)}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
            placeholder="e.g. 7850"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 flex items-center gap-1.5">
            Yield Strength (MPa)
            <span className="relative group">
              <Info className="h-3 w-3 text-[hsl(var(--muted-foreground))] cursor-help" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 rounded-md bg-[hsl(var(--popover))] border border-[hsl(var(--border))] px-2.5 py-1.5 text-[10px] text-[hsl(var(--popover-foreground))] shadow-lg z-10">
                Used to calculate safety factor. Leave blank to skip.
              </span>
            </span>
          </label>
          <input
            type="number"
            step="1"
            min={0}
            value={material.yield_strength ? +(material.yield_strength / 1e6).toFixed(2) : ''}
            onChange={(e) => update('yield_strength', e.target.value ? +e.target.value * 1e6 : null)}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
            placeholder="optional"
          />
        </div>
      </div>
    </div>
  );
}
