import { Upload, Box, ArrowUpFromLine } from 'lucide-react';

export function GeometriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Geometry Library</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Manage your CAD geometry files
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 active:brightness-95 transition-all">
          <Upload className="h-4 w-4" />
          Upload Geometry
          <input type="file" accept=".stp,.step,.igs,.iges" className="hidden" />
        </label>
      </div>

      <div className="rounded-xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-colors hover:border-[hsl(var(--primary)/0.4)]">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="rounded-2xl bg-[hsl(var(--primary)/0.1)] p-5 mb-5">
            <Box className="h-10 w-10 text-[hsl(var(--primary))]" />
          </div>
          <p className="text-lg font-semibold">No geometries uploaded yet</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xs text-center">
            Upload .stp or .igs CAD files to use them in your simulations
          </p>
          <label className="mt-6 flex cursor-pointer items-center gap-2 rounded-lg border border-[hsl(var(--input))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--accent))] transition-colors">
            <ArrowUpFromLine className="h-4 w-4" />
            Choose files
            <input type="file" accept=".stp,.step,.igs,.iges" className="hidden" multiple />
          </label>
        </div>
      </div>
    </div>
  );
}
