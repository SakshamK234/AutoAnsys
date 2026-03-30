import { useState } from 'react';
import { Upload, Box, ArrowUpFromLine, Download, Trash2, X } from 'lucide-react';
import { useGeometries, useUploadGeometry, useDeleteGeometry, useDownloadGeometry } from '@/hooks/use-geometries';
import { formatFileSize, formatDate } from '@/lib/utils';

function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const upload = useUploadGeometry();
  const [file, setFile] = useState<File | null>(null);
  const [componentName, setComponentName] = useState('');
  const [description, setDescription] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    if (componentName.trim()) formData.append('component_name', componentName.trim());
    if (description.trim()) formData.append('description', description.trim());
    upload.mutate(formData, {
      onSuccess: () => {
        setFile(null);
        setComponentName('');
        setDescription('');
        onClose();
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Upload Geometry</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">CAD File</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[hsl(var(--border))] p-6 transition-colors hover:border-[hsl(var(--primary)/0.4)]">
              <div className="text-center">
                <ArrowUpFromLine className="mx-auto h-6 w-6 text-[hsl(var(--muted-foreground))] mb-2" />
                <p className="text-sm font-medium">{file ? file.name : 'Choose a file'}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">.stp, .step, .igs, .iges</p>
              </div>
              <input
                type="file"
                accept=".stp,.step,.igs,.iges"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Component Name (optional)</label>
            <input
              type="text"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              placeholder="e.g., Front Wing v3"
              className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description..."
              className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
            />
          </div>

          {upload.isError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-500">
              Upload failed. Check file format and try again.
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--accent))] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || upload.isPending}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {upload.isPending ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function GeometriesPage() {
  const { data, isLoading } = useGeometries();
  const deleteGeo = useDeleteGeometry();
  const downloadGeo = useDownloadGeometry();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const geometries = data?.items ?? [];

  const handleDelete = (id: string) => {
    deleteGeo.mutate(id, { onSuccess: () => setDeleteConfirm(null) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Geometry Library</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Manage your CAD geometry files
          </p>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 active:brightness-95 transition-all"
        >
          <Upload className="h-4 w-4" />
          Upload Geometry
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
        </div>
      ) : geometries.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-colors hover:border-[hsl(var(--primary)/0.4)]">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-2xl bg-[hsl(var(--primary)/0.1)] p-5 mb-5">
              <Box className="h-10 w-10 text-[hsl(var(--primary))]" />
            </div>
            <p className="text-lg font-semibold">No geometries uploaded yet</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xs text-center">
              Upload .stp or .igs CAD files to use them in your simulations
            </p>
            <button
              onClick={() => setUploadOpen(true)}
              className="mt-6 flex items-center gap-2 rounded-lg border border-[hsl(var(--input))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--accent))] transition-colors"
            >
              <ArrowUpFromLine className="h-4 w-4" />
              Upload your first geometry
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">File</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Component</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Size</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Uploaded</th>
                <th className="px-5 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {geometries.map((g) => (
                <tr key={g.id} className="border-b border-[hsl(var(--border))] last:border-0 transition-colors hover:bg-[hsl(var(--muted))]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-[hsl(var(--primary)/0.1)] p-1.5">
                        <Box className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                      </div>
                      <span className="font-medium truncate max-w-[200px]">{g.original_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">{g.component_name || '—'}</td>
                  <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))] font-mono text-xs">{formatFileSize(g.file_size)}</td>
                  <td className="px-5 py-3.5 text-[hsl(var(--muted-foreground))]">{formatDate(g.created_at)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => downloadGeo.mutate(g.id)}
                        disabled={downloadGeo.isPending}
                        className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      {deleteConfirm === g.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(g.id)}
                            disabled={deleteGeo.isPending}
                            className="rounded-lg px-2 py-1 text-[10px] font-medium bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                          >
                            {deleteGeo.isPending ? '...' : 'Delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded-lg px-2 py-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(g.id)}
                          className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
