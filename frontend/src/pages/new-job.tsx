import { JobWizard } from '@/components/wizard/job-wizard';

export function NewJobPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">New Simulation</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Configure and submit a CFD simulation to the HPC cluster
        </p>
      </div>
      <JobWizard />
    </div>
  );
}
