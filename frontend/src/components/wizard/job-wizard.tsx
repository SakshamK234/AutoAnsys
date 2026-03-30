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
import { ArrowLeft, ArrowRight, Check, Send } from 'lucide-react';
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
      <div className="mb-8">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-initial">
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className="flex items-center gap-2 group"
              >
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-all',
                    i === step
                      ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-md shadow-[hsl(var(--primary)/0.3)]'
                      : i < step
                      ? 'bg-emerald-500/15 text-emerald-500'
                      : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                  )}
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={cn(
                  'text-xs font-medium hidden sm:block whitespace-nowrap',
                  i === step ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'
                )}>
                  {s}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'h-px flex-1 mx-3',
                  i < step ? 'bg-emerald-500/30' : 'bg-[hsl(var(--border))]'
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 animate-fade-in">
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
          className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium disabled:opacity-30 hover:bg-[hsl(var(--accent))] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 active:brightness-95 transition-all"
          >
            Next
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? 'Submitting...' : 'Submit Simulation'}
          </button>
        )}
      </div>
    </div>
  );
}
