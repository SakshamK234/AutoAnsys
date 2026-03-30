import { JobWizard } from '@/components/wizard/job-wizard';
import { Rocket } from 'lucide-react';

export function NewJobPage() {
  return (
    <div>
      <div className="mb-8 flex items-start gap-4">
        <div className="rounded-xl bg-[hsl(var(--primary)/0.1)] p-3">
          <Rocket className="h-6 w-6 text-[hsl(var(--primary))]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Simulation</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Configure and submit a CFD simulation to the HPC cluster
          </p>
        </div>
      </div>
      <JobWizard />
    </div>
  );
}
