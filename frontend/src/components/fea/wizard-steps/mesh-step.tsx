import { useState } from 'react';
import { MeshUpload } from '@/components/fea/mesh-upload';
import { useGeometries } from '@/hooks/use-geometries';
import { formatFileSize } from '@/lib/utils';
import { Box, X } from 'lucide-react';

interface MeshStepProps {
  meshFileId: string | null;
  meshFileName: string | null;
  onMeshSelected: (id: string, name: string) => void;
  onMeshCleared: () => void;
}

export function MeshStep({ meshFileId, meshFileName, onMeshSelected, onMeshCleared }: MeshStepProps) {
  const [showLibrary, setShowLibrary] = useState(false);
  const { data, isLoading } = useGeometries();
  const geometries = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Mesh & Geometry</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Upload a mesh file or choose from your geometry library.
        </p>
      </div>

      <MeshUpload
        fileId={meshFileId}
        fileName={meshFileName}
        onUploaded={onMeshSelected}
        onClear={onMeshCleared}
      />

      {!meshFileId && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[hsl(var(--border))]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[hsl(var(--card))] px-3 text-[hsl(var(--muted-foreground))]">
              or choose from library
            </span>
          </div>
        </div>
      )}

      {!meshFileId && !showLibrary && (
        <button
          onClick={() => setShowLibrary(true)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border))] px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary))] transition-colors w-full justify-center"
        >
          <Box className="h-4 w-4" />
          Browse Geometry Library
        </button>
      )}

      {!meshFileId && showLibrary && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
            <p className="text-sm font-medium">Geometry Library</p>
            <button
              onClick={() => setShowLibrary(false)}
              className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
              </div>
            ) : geometries.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No geometries uploaded yet.
                </p>
              </div>
            ) : (
              geometries.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    onMeshSelected(g.s3_key || g.id, g.original_name);
                    setShowLibrary(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[hsl(var(--muted))] transition-colors"
                >
                  <Box className="h-4 w-4 text-[hsl(var(--primary))] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.original_name}</p>
                    {g.component_name && (
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{g.component_name}</p>
                    )}
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                    {formatFileSize(g.file_size)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
