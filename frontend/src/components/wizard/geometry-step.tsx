import { useGeometries } from '@/hooks/use-geometries';
import { formatFileSize } from '@/lib/utils';

interface GeometryStepProps {
  name: string;
  setName: (name: string) => void;
  geometryId: string;
  setGeometryId: (id: string) => void;
}

export function GeometryStep({ name, setName, geometryId, setGeometryId }: GeometryStepProps) {
  const { data, isLoading } = useGeometries();
  const geometries = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Geometry & Name</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Select a CAD geometry and name your simulation.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Simulation Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Front Wing v3 — 20 m/s"
          className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Select Geometry</label>
        {isLoading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading geometries...</p>
        ) : geometries.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No geometries uploaded yet. Go to the Geometries page to upload one first.
          </p>
        ) : (
          <select
            value={geometryId}
            onChange={(e) => setGeometryId(e.target.value)}
            className="w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Select a geometry...</option>
            {geometries.map((g) => (
              <option key={g.id} value={g.id}>
                {g.original_name} {g.component_name ? `(${g.component_name})` : ''} — {formatFileSize(g.file_size)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
