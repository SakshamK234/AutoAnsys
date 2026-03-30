import { Upload, Box } from 'lucide-react';

export function GeometriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Geometry Library</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Manage your CAD geometry files
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90">
          <Upload className="h-4 w-4" />
          Upload Geometry
          <input type="file" accept=".stp,.step,.igs,.iges" className="hidden" />
        </label>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--border))] py-16">
        <Box className="h-12 w-12 text-[hsl(var(--muted-foreground))]" />
        <p className="mt-4 text-lg font-medium">No geometries uploaded yet</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Upload .stp or .igs files to get started
        </p>
      </div>
    </div>
  );
}
