import { ENCLOSURE_PRESETS } from '@/lib/constants';
import { calculateYPlus } from '@/lib/utils';
import { useState } from 'react';
import type { MeshConfig, EnclosureConfig } from '@/types';

const DEFAULT_ENCLOSURE: EnclosureConfig = {
  back_mm: 8000,
  front_mm: 1000,
  top_mm: 2500,
  bottom_mm: 2500,
  left_mm: 2500,
  right_mm: 2500,
  flow_axis: '+x',
};

interface MeshConfigStepProps {
  config: MeshConfig;
  setConfig: (config: MeshConfig) => void;
}

export function MeshConfigStep({ config, setConfig }: MeshConfigStepProps) {
  const [yPlusInputs, setYPlusInputs] = useState({ velocity: 20, length: 1.5, targetYPlus: 1 });

  const update = (path: string, value: any) => {
    const keys = path.split('.');
    const newConfig = JSON.parse(JSON.stringify(config));
    let obj = newConfig;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
    setConfig(newConfig);
  };

  const estimatedHeight = calculateYPlus(yPlusInputs.velocity, 1.225, 1.789e-5, yPlusInputs.length, yPlusInputs.targetYPlus);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-1">Mesh Configuration</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Configure the Fluent Mesher Watertight Geometry workflow parameters.</p>
      </div>

      {/* Surface Mesh */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Surface Mesh</h4>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium mb-1">Min Size (m)</label><input type="number" step="0.001" value={config.surface_mesh.min_size} onChange={(e) => update('surface_mesh.min_size', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Max Size (m)</label><input type="number" step="0.01" value={config.surface_mesh.max_size} onChange={(e) => update('surface_mesh.max_size', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Growth Rate</label><input type="number" step="0.05" value={config.surface_mesh.growth_rate} onChange={(e) => update('surface_mesh.growth_rate', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Curvature Normal Angle (deg)</label><input type="number" value={config.surface_mesh.curvature_normal_angle} onChange={(e) => update('surface_mesh.curvature_normal_angle', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
        </div>
      </section>

      {/* Enclosure (SOP-style, mm, measured from part) */}
      <section>
        <h4 className="font-medium mb-1 text-[hsl(var(--primary))]">Enclosure (Fluid Domain)</h4>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
          Distances from the part to each enclosure face, in mm (per FSAE SOP: back 8000, front 1000, rest 2500).
        </p>
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1">Preset</label>
          <select
            onChange={(e) => {
              const preset = ENCLOSURE_PRESETS[e.target.value];
              if (preset) setConfig({ ...config, enclosure: preset });
            }}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Custom</option>
            {Object.keys(ENCLOSURE_PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        {(() => {
          const enc = config.enclosure ?? DEFAULT_ENCLOSURE;
          const setEnc = (patch: Partial<EnclosureConfig>) =>
            setConfig({ ...config, enclosure: { ...enc, ...patch } });
          return (
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium mb-1">Back (mm)</label><input type="number" value={enc.back_mm} onChange={(e) => setEnc({ back_mm: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium mb-1">Front (mm)</label><input type="number" value={enc.front_mm} onChange={(e) => setEnc({ front_mm: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium mb-1">Top (mm)</label><input type="number" value={enc.top_mm} onChange={(e) => setEnc({ top_mm: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium mb-1">Bottom (mm)</label><input type="number" value={enc.bottom_mm} onChange={(e) => setEnc({ bottom_mm: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium mb-1">Left (mm)</label><input type="number" value={enc.left_mm} onChange={(e) => setEnc({ left_mm: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs font-medium mb-1">Right (mm)</label><input type="number" value={enc.right_mm} onChange={(e) => setEnc({ right_mm: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
            </div>
          );
        })()}
      </section>

      {/* Mesh Quality (SOP auto-improve loops) */}
      <section>
        <h4 className="font-medium mb-1 text-[hsl(var(--primary))]">Mesh Quality</h4>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
          SOP auto-improvement: re-run the improve-surface-mesh task if skewness exceeds the threshold (0.6), and the improve-volume-mesh task if orthogonal quality is below 0.15.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Surface Skewness Threshold</label>
            <input type="number" step="0.05" value={config.mesh_quality.surface_skewness_threshold} onChange={(e) => update('mesh_quality.surface_skewness_threshold', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Volume Ortho-Quality Threshold</label>
            <input type="number" step="0.01" value={config.mesh_quality.volume_orthogonal_quality_threshold} onChange={(e) => update('mesh_quality.volume_orthogonal_quality_threshold', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="flex items-end gap-2">
            <input
              id="mesh-auto-improve"
              type="checkbox"
              checked={config.mesh_quality.auto_improve}
              onChange={(e) => update('mesh_quality.auto_improve', e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="mesh-auto-improve" className="text-xs font-medium">
              Auto-improve if over/under threshold
            </label>
          </div>
        </div>
      </section>

      {/* Volume Mesh */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Volume Mesh & Boundary Layers</h4>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium mb-1">Max Cell Length (m)</label><input type="number" step="0.01" value={config.volume_mesh.max_cell_length} onChange={(e) => update('volume_mesh.max_cell_length', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Growth Rate</label><input type="number" step="0.05" value={config.volume_mesh.growth_rate} onChange={(e) => update('volume_mesh.growth_rate', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">First Layer Height (m)</label><input type="number" step="0.00001" value={config.volume_mesh.first_layer_height} onChange={(e) => update('volume_mesh.first_layer_height', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Number of Layers</label><input type="number" value={config.volume_mesh.num_layers} onChange={(e) => update('volume_mesh.num_layers', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">BL Growth Rate</label><input type="number" step="0.05" value={config.volume_mesh.bl_growth_rate} onChange={(e) => update('volume_mesh.bl_growth_rate', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
        </div>
      </section>

      {/* Geometry Unit */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Geometry</h4>
        <div className="w-48">
          <label className="block text-xs font-medium mb-1">Geometry Unit</label>
          <select value={config.geometry_unit} onChange={(e) => update('geometry_unit', e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm">
            <option value="m">Meters (m)</option>
            <option value="mm">Millimeters (mm)</option>
            <option value="in">Inches (in)</option>
          </select>
        </div>
      </section>

      {/* y+ Estimator */}
      <section className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
        <h4 className="font-medium mb-3 text-blue-700 dark:text-blue-300">y+ Estimator</h4>
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div><label className="block text-xs font-medium mb-1">Velocity (m/s)</label><input type="number" value={yPlusInputs.velocity} onChange={(e) => setYPlusInputs({ ...yPlusInputs, velocity: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Char. Length (m)</label><input type="number" step="0.1" value={yPlusInputs.length} onChange={(e) => setYPlusInputs({ ...yPlusInputs, length: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Target y+</label><input type="number" value={yPlusInputs.targetYPlus} onChange={(e) => setYPlusInputs({ ...yPlusInputs, targetYPlus: +e.target.value })} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
        </div>
        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Estimated first layer height: <span className="font-mono">{estimatedHeight.toExponential(3)} m</span>
        </p>
        <button
          onClick={() => update('volume_mesh.first_layer_height', +estimatedHeight.toFixed(8))}
          className="mt-2 text-xs text-blue-600 underline dark:text-blue-400"
        >
          Apply to mesh config
        </button>
      </section>
    </div>
  );
}
