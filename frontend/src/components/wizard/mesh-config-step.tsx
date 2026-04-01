import { WIND_TUNNEL_PRESETS } from '@/lib/constants';
import { calculateYPlus } from '@/lib/utils';
import { useState } from 'react';
import type { MeshConfig } from '@/types';

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

      {/* Wind Tunnel */}
      <section>
        <h4 className="font-medium mb-3 text-[hsl(var(--primary))]">Wind Tunnel (Fluid Domain)</h4>
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1">Preset</label>
          <select
            onChange={(e) => {
              const preset = WIND_TUNNEL_PRESETS[e.target.value];
              if (preset) setConfig({ ...config, wind_tunnel: preset });
            }}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Custom</option>
            {Object.keys(WIND_TUNNEL_PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><label className="block text-xs font-medium mb-1">X Min (m)</label><input type="number" value={config.wind_tunnel.x_min} onChange={(e) => update('wind_tunnel.x_min', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">X Max (m)</label><input type="number" value={config.wind_tunnel.x_max} onChange={(e) => update('wind_tunnel.x_max', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Y Min (m)</label><input type="number" value={config.wind_tunnel.y_min} onChange={(e) => update('wind_tunnel.y_min', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Y Max (m)</label><input type="number" value={config.wind_tunnel.y_max} onChange={(e) => update('wind_tunnel.y_max', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Z Min (m)</label><input type="number" value={config.wind_tunnel.z_min} onChange={(e) => update('wind_tunnel.z_min', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Z Max (m)</label><input type="number" value={config.wind_tunnel.z_max} onChange={(e) => update('wind_tunnel.z_max', +e.target.value)} className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm" /></div>
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
