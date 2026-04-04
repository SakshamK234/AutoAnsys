import { FeaWizard } from '@/components/fea/fea-wizard';
import { Wrench } from 'lucide-react';

export function FeaNewPage() {
  return (
    <div>
      <div className="mb-8 flex items-start gap-4">
        <div className="rounded-xl bg-[hsl(var(--primary)/0.1)] p-3">
          <Wrench className="h-6 w-6 text-[hsl(var(--primary))]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New FEA Analysis</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Configure and submit a static structural analysis to the HPC cluster
          </p>
        </div>
      </div>
      <FeaWizard />
    </div>
  );
}
