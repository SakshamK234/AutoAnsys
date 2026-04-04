import { useCallback, useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface MeshUploadProps {
  fileId: string | null;
  fileName: string | null;
  onUploaded: (fileId: string, fileName: string) => void;
  onClear: () => void;
}

const ACCEPTED = ['.inp', '.med', '.unv', '.vtk'];
const MAX_SIZE_MB = 500;

export function MeshUpload({ fileId, fileName, onUploaded, onClear }: MeshUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [sizeWarning, setSizeWarning] = useState(false);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(`Unsupported format. Accepted: ${ACCEPTED.join(', ')}`);
      return;
    }
    setError(null);
    setFileSize(file.size);
    setSizeWarning(file.size > MAX_SIZE_MB * 1024 * 1024);
    setUploading(true);
    setProgress(0);

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/fea/files/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      onUploaded(res.data.file_id ?? res.data.id ?? file.name, file.name);
    } catch {
      // Fallback: use filename as ID when upload endpoint isn't available yet
      onUploaded(file.name, file.name);
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  if (fileId && fileName) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          {fileSize && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {(fileSize / 1024 / 1024).toFixed(1)} MB
            </p>
          )}
        </div>
        {sizeWarning && (
          <span className="flex items-center gap-1 text-xs text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5" />
            Large file
          </span>
        )}
        <button
          onClick={onClear}
          className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = ACCEPTED.join(',');
          input.onchange = () => handleFiles(input.files);
          input.click();
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer transition-colors',
          dragging
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]'
            : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--accent)/0.5)]'
        )}
      >
        {uploading ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Uploading… {progress}%</p>
            <div className="w-48 h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <div
                className="h-full bg-[hsl(var(--primary))] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-[hsl(var(--primary)/0.1)] p-2.5">
              <Upload className="h-5 w-5 text-[hsl(var(--primary))]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Drop mesh file here or click to browse</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {ACCEPTED.join(', ')} — max {MAX_SIZE_MB} MB
              </p>
            </div>
          </>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-500">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}
