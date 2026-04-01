import { FileText, Plus, Sparkles } from 'lucide-react';

export function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulation Templates</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Save and reuse simulation configurations
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 active:brightness-95 transition-all">
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      <div className="rounded-xl border-2 border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-colors hover:border-[hsl(var(--primary)/0.4)]">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="rounded-2xl bg-[hsl(var(--primary)/0.1)] p-5 mb-5">
            <FileText className="h-10 w-10 text-[hsl(var(--primary))]" />
          </div>
          <p className="text-lg font-semibold">No templates yet</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-xs text-center">
            Create templates from completed simulations to quickly set up future runs
          </p>
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-[hsl(var(--muted))] px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
            Complete a simulation first, then save its config as a template
          </div>
        </div>
      </div>
    </div>
  );
}
