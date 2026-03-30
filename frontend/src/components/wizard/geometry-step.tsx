import { useGeometries } from '@/hooks/use-geometries';
import { formatFileSize } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

interface GeometryStepProps {
  name: string;
  setName: (name: string) => void;
  geometryId: string;
  setGeometryId: (id: string) => void;
}

export function GeometryStep({ name, setName, geometryId, setGeometryId }: GeometryStepProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useGeometries();
  const geometries = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Geometry & Name</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Select a CAD geometry and name your simulation.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Simulation Name <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Front Wing v3 — 20 m/s"
          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
        />
        {name.length > 0 && !name.trim() && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
            <AlertCircle className="h-3 w-3" /> Name cannot be only whitespace
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Select Geometry <span className="text-rose-500">*</span>
        </label>
        {isLoading ? (
          <div className="flex items-center gap-2 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
            <span className="text-sm text-[hsl(var(--muted-foreground))]">Loading geometries...</span>
          </div>
        ) : geometries.length === 0 ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No geometries uploaded yet.
            </p>
            <button
              type="button"
              onClick={() => navigate('/geometries')}
              className="mt-2 text-sm font-medium text-[hsl(var(--primary))] hover:underline"
            >
              Go to Geometry Library to upload one
            </button>
          </div>
        ) : (
          <select
            value={geometryId}
            onChange={(e) => setGeometryId(e.target.value)}
            className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
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
