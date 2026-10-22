import { useState } from 'react';
import type { FormEvent } from 'react';
import { Download, Plus, UploadCloud } from 'lucide-react';
import { geometryDownloadUrl, useGeometries, useGeometryMutations } from '../lib/queries';
import { errorText } from '../lib/api';
import { useAuth, isGuest } from '../stores/auth';
import { PageHeader } from '../components/chrome';
import { Button, ConfirmButton, Dialog, EmptyState, Field, Input, Loading, useToast } from '../components/ui';
import { formatAgo, formatBytes } from '../lib/format';

export default function GeometriesPage() {
  const geometries = useGeometries();
  const { upload, remove } = useGeometryMutations();
  const toast = useToast();
  const { user } = useAuth();
  const guest = isGuest(user);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [componentName, setComponentName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync({
        file,
        component_name: componentName || undefined,
        description: description || undefined,
      });
      toast('ok', 'Geometry uploaded');
      setOpen(false);
      setFile(null);
      setComponentName('');
      setDescription('');
    } catch (err) {
      setError(errorText(err, 'Upload failed'));
    }
  }

  return (
    <div className="settle">
      <PageHeader
        title="Geometries"
        sub="CAD exports — Parasolid (.x_t) per the SOP; STEP/IGES accepted."
        actions={
          !guest && (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus size={14} strokeWidth={3} /> Upload
            </Button>
          )
        }
      />

      {geometries.isLoading ? (
        <Loading label="Loading geometries" />
      ) : geometries.data?.items.length ? (
        <div className="border border-seam bg-paper">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-condensed border-b border-seam text-left text-[11px] tracking-[0.12em] text-ink-3 uppercase">
                <th className="px-4 py-2 font-bold">Part</th>
                <th className="hidden px-4 py-2 font-bold sm:table-cell">File</th>
                <th className="px-4 py-2 text-right font-bold">Size</th>
                <th className="hidden px-4 py-2 text-right font-bold sm:table-cell">Uploaded</th>
                <th className="w-28 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {geometries.data.items.map((g) => (
                <tr key={g.id} className="border-b border-seam last:border-0 hover:bg-ground/60">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold">{g.component_name || g.original_name}</p>
                    {g.description && <p className="text-xs text-ink-3">{g.description}</p>}
                  </td>
                  <td className="font-mono hidden px-4 py-2.5 text-[13px] text-ink-2 sm:table-cell">
                    {g.original_name}
                  </td>
                  <td className="font-mono tnum px-4 py-2.5 text-right text-[13px]">{formatBytes(g.file_size)}</td>
                  <td className="hidden px-4 py-2.5 text-right text-ink-3 sm:table-cell">{formatAgo(g.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        aria-label={`Download ${g.original_name}`}
                        className="cursor-pointer p-1.5 text-ink-3 hover:text-race"
                        onClick={() =>
                          geometryDownloadUrl(g.id)
                            .then((url) => window.open(url, '_blank', 'noopener'))
                            .catch((e) => toast('error', errorText(e, 'Download failed')))
                        }
                      >
                        <Download size={15} />
                      </button>
                      {!guest && g.user_id === user?.id && (
                        <ConfirmButton
                          label="Delete"
                          variant="ghost"
                          busy={remove.isPending}
                          onConfirm={() =>
                            remove
                              .mutateAsync(g.id)
                              .then(() => toast('ok', 'Geometry deleted'))
                              .catch((e) => toast('error', errorText(e)))
                          }
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No geometries"
          detail="Export your part from NX or Discovery as Parasolid and upload it here to start a run."
          action={
            !guest && (
              <Button variant="primary" onClick={() => setOpen(true)}>
                Upload a part
              </Button>
            )
          }
        />
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Upload geometry">
        <form onSubmit={onUpload} className="flex flex-col gap-4">
          <label
            className="flex cursor-pointer flex-col items-center gap-2 border border-dashed border-seam-strong px-4 py-8 text-center hover:border-race"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
          >
            <UploadCloud size={22} className="text-ink-3" />
            <span className="text-sm font-medium">{file ? file.name : 'Drop a file or click to browse'}</span>
            <span className="text-xs text-ink-3">.x_t · .x_b · .stp · .step · .igs · .iges</span>
            <input
              type="file"
              accept=".x_t,.x_b,.xmt_txt,.xmt_bin,.stp,.step,.igs,.iges,.dsco"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Field label="Part name">
            <Input value={componentName} onChange={(e) => setComponentName(e.target.value)} placeholder="e.g. Rear wing v1.5" />
          </Field>
          <Field label="Notes">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" />
          </Field>
          {error && (
            <p role="alert" className="border border-crit/40 bg-crit-tint px-3 py-2 text-sm text-crit">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" busy={upload.isPending} disabled={!file}>
            Upload
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
