import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { DEFAULT_MESH_CONFIG, DEFAULT_SOLVER_CONFIG, DEFAULT_SLURM_CONFIG } from '@/lib/constants';
import { GeometryStep } from './geometry-step';
import { MeshConfigStep } from './mesh-config-step';
import { SolverConfigStep } from './solver-config-step';
import { ResourceConfigStep } from './resource-config-step';
import { ReviewStep } from './review-step';
import type { MeshConfig, SolverConfig, SlurmConfig } from '@/types';

const STEPS = ['Geometry', 'Mesh', 'Solver', 'Resources', 'Review'];

export function JobWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [geometryId, setGeometryId] = useState('');
  const [meshConfig, setMeshConfig] = useState<MeshConfig>(DEFAULT_MESH_CONFIG);
  const [solverConfig, setSolverConfig] = useState<SolverConfig>(DEFAULT_SOLVER_CONFIG);
  const [slurmConfig, setSlurmConfig] = useState<SlurmConfig>(DEFAULT_SLURM_CONFIG);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/jobs', {
        name,
        geometry_id: geometryId,
        mesh_config: meshConfig,
        solver_config: solverConfig,
        slurm_config: slurmConfig,
      });
      navigate(`/jobs/${res.data.id}`);
    } catch (err) {
      console.error('Failed to submit job:', err);
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                i === step
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : i < step
                  ? 'bg-green-500 text-white'
                  : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
              )}
            >
              {i < step ? '\u2713' : i + 1}
            </button>
            <span className={cn('ml-2 text-sm font-medium', i === step ? 'text-foreground' : 'text-[hsl(var(--muted-foreground))]')}>
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn('mx-4 h-px w-12', i < step ? 'bg-green-500' : 'bg-[hsl(var(--border))]')} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        {step === 0 && <GeometryStep name={name} setName={setName} geometryId={geometryId} setGeometryId={setGeometryId} />}
        {step === 1 && <MeshConfigStep config={meshConfig} setConfig={setMeshConfig} />}
        {step === 2 && <SolverConfigStep config={solverConfig} setConfig={setSolverConfig} />}
        {step === 3 && <ResourceConfigStep config={slurmConfig} setConfig={setSlurmConfig} />}
        {step === 4 && <ReviewStep name={name} geometryId={geometryId} meshConfig={meshConfig} solverConfig={solverConfig} slurmConfig={slurmConfig} />}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-[hsl(var(--accent))]"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Simulation'}
          </button>
        )}
      </div>
    </div>
  );
}
