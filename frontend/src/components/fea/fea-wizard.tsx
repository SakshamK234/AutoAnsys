import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Check, Send } from 'lucide-react';
import { MeshStep } from './wizard-steps/mesh-step';
import { MaterialStep } from './wizard-steps/material-step';
import { ConstraintsStep } from './wizard-steps/constraints-step';
import { ReviewStep } from './wizard-steps/review-step';
import { useSubmitFeaJob } from '@/hooks/use-fea';
import { MATERIAL_PRESETS } from '@/lib/fea-constants';
import type { FEAMaterial, FEAConstraint, FEALoad } from '@/types/fea';

const STEPS = ['Mesh & Geometry', 'Material', 'Constraints & Loads', 'Review & Submit'];

const DEFAULT_MATERIAL: FEAMaterial = {
  preset: 'steel',
  youngs_modulus: MATERIAL_PRESETS.steel.youngs_modulus,
  poissons_ratio: MATERIAL_PRESETS.steel.poissons_ratio,
  density: MATERIAL_PRESETS.steel.density,
  yield_strength: MATERIAL_PRESETS.steel.yield_strength,
};

export function FeaWizard() {
  const navigate = useNavigate();
  const submitJob = useSubmitFeaJob();

  const [step, setStep] = useState(0);
  const [meshFileId, setMeshFileId] = useState<string | null>(null);
  const [meshFileName, setMeshFileName] = useState<string | null>(null);
  const [material, setMaterial] = useState<FEAMaterial>(DEFAULT_MATERIAL);
  const [constraints, setConstraints] = useState<FEAConstraint[]>([
    { id: crypto.randomUUID(), type: 'fixed', face_ids: [] },
  ]);
  const [loads, setLoads] = useState<FEALoad[]>([
    { id: crypto.randomUUID(), type: 'force', face_ids: [], magnitude: 0, direction: { x: 0, y: -1, z: 0 } },
  ]);
  const [jobName, setJobName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stepValid = [
    !!meshFileId,
    material.youngs_modulus > 0 && material.poissons_ratio > 0 && material.density > 0,
    constraints.length > 0 && loads.length > 0,
    jobName.trim().length > 0,
  ];

  const canProceed = stepValid[step];

  const handleSubmit = async () => {
    if (!meshFileId) return;
    setError(null);
    try {
      const result = await submitJob.mutateAsync({
        job_name: jobName,
        mesh_file_id: meshFileId,
        mesh_file_name: meshFileName ?? undefined,
        material,
        constraints: constraints.map(({ id: _id, ...rest }) => rest),
        loads: loads.map(({ id: _id, ...rest }) => rest),
        arc: {
          job_name: jobName,
          partition: 'standard',
          nodes: 1,
          tasks_per_node: 8,
          walltime: '02:00:00',
        },
      });
      navigate(`/fea/jobs/${result.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || 'Failed to submit FEA job');
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
        {step === 0 && (
          <MeshStep
            meshFileId={meshFileId}
            meshFileName={meshFileName}
            onMeshSelected={(id, name) => {
              setMeshFileId(id);
              setMeshFileName(name);
              if (!jobName) {
                setJobName(name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_'));
              }
            }}
            onMeshCleared={() => { setMeshFileId(null); setMeshFileName(null); }}
          />
        )}
        {step === 1 && (
          <MaterialStep material={material} onChange={setMaterial} />
        )}
        {step === 2 && (
          <ConstraintsStep
            constraints={constraints}
            onConstraintsChange={setConstraints}
            loads={loads}
            onLoadsChange={setLoads}
          />
        )}
        {step === 3 && (
          <ReviewStep
            meshFileName={meshFileName}
            material={material}
            constraints={constraints}
            loads={loads}
            jobName={jobName}
            onJobNameChange={setJobName}
            error={error}
            submitting={submitJob.isPending}
          />
        )}
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
            disabled={!canProceed}
            className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Next
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed || submitJob.isPending}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            {submitJob.isPending ? 'Submitting…' : 'Submit Analysis'}
          </button>
        )}
      </div>
    </div>
  );
}
