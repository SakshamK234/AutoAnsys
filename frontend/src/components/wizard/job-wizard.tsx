import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { DEFAULT_MESH_CONFIG, DEFAULT_SOLVER_CONFIG, DEFAULT_SLURM_CONFIG, applyCfdModeDefaults } from '@/lib/constants';
import { GeometryStep, type WorkflowMode } from './geometry-step';
import { MeshConfigStep } from './mesh-config-step';
import { SolverConfigStep } from './solver-config-step';
import { ResourceConfigStep } from './resource-config-step';
import { ReviewStep } from './review-step';
import { ArrowLeft, ArrowRight, Check, Send, AlertCircle, X } from 'lucide-react';
import type { MeshConfig, SolverConfig, SlurmConfig, CfdMode } from '@/types';

const STEPS_COMBINED = ['Geometry', 'Mesh', 'Solver', 'Resources', 'Review'];
const STEPS_MESH_ONLY = ['Geometry', 'Mesh', 'Resources', 'Review'];
const STEPS_SOLVE_FROM_MESH = ['Geometry', 'Solver', 'Resources', 'Review'];

function validateStep0(name: string, geometryId: string): string | null {
  if (!name.trim()) return 'Simulation name is required.';
  if (!geometryId) return 'Please select a geometry.';
  return null;
}

function validateStep1(config: MeshConfig): string | null {
  const sm = config.surface_mesh;
  if (sm.min_size <= 0 || sm.max_size <= 0) return 'Surface mesh sizes must be positive.';
  if (sm.min_size >= sm.max_size) return 'Min size must be less than max size.';
  if (sm.growth_rate < 1.0 || sm.growth_rate > 5.0) return 'Growth rate must be between 1.0 and 5.0.';
  const vm = config.volume_mesh;
  if (vm.max_cell_length <= 0) return 'Max cell length must be positive.';
  if (vm.first_layer_height <= 0) return 'First layer height must be positive.';
  if (vm.num_layers < 1 || vm.num_layers > 50) return 'Number of layers must be between 1 and 50.';
  return null;
}

function validateStep3(config: SlurmConfig): string | null {
  if (config.nodes < 1 || config.nodes > 64) return 'Nodes must be between 1 and 64.';
  if (config.cores_per_node < 1 || config.cores_per_node > 128) return 'Cores per node must be between 1 and 128.';
  if (config.memory_gb < 1 || config.memory_gb > 1024) return 'Memory must be between 1 and 1024 GB.';
  if (config.walltime_hours < 1 || config.walltime_hours > 168) return 'Wall time must be between 1 and 168 hours.';
  return null;
}

export function JobWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const tplState = (location.state as { templateConfig?: any; templateName?: string }) || {};

  const [step, setStep] = useState(0);
  const [name, setName] = useState(tplState.templateName ? `${tplState.templateName} — Run` : '');
  const [geometryId, setGeometryId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [cfdMode, setCfdMode] = useState<CfdMode>('individual_part');
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('combined');
  const [meshId, setMeshId] = useState('');
  const [outputPath, setOutputPath] = useState('/home/<username>/');

  const STEPS =
    workflowMode === 'mesh_only'
      ? STEPS_MESH_ONLY
      : workflowMode === 'solve_from_mesh'
      ? STEPS_SOLVE_FROM_MESH
      : STEPS_COMBINED;
  const [meshConfig, setMeshConfig] = useState<MeshConfig>({ ...DEFAULT_MESH_CONFIG, ...(tplState.templateConfig?.mesh || {}) });
  const [solverConfig, setSolverConfig] = useState<SolverConfig>({ ...DEFAULT_SOLVER_CONFIG, ...(tplState.templateConfig?.solver || {}) });
  const [slurmConfig, setSlurmConfig] = useState<SlurmConfig>({ ...DEFAULT_SLURM_CONFIG, ...(tplState.templateConfig?.slurm || {}) });

  // Re-apply mode defaults (iterations, wheel zones) whenever CFD mode changes.
  const handleModeChange = (mode: CfdMode) => {
    setCfdMode(mode);
    setSolverConfig((prev) => applyCfdModeDefaults(mode, prev));
  };
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<'creating' | 'submitting' | null>(null);
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');

  // When switching workflow modes, snap back to step 0 so the step index
  // stays consistent with the new step list.
  const handleWorkflowChange = (mode: WorkflowMode) => {
    setWorkflowMode(mode);
    setStep(0);
    setValidationError('');
  };

  const validateCurrentStep = (): boolean => {
    let err: string | null = null;
    const stepName = STEPS[step];

    if (stepName === 'Geometry') {
      err = validateStep0(name, geometryId);
      if (!err && workflowMode === 'solve_from_mesh' && !meshId) {
        err = 'Please select a completed mesh to solve against.';
      }
    } else if (stepName === 'Mesh') {
      err = validateStep1(meshConfig);
    } else if (stepName === 'Resources') {
      err = validateStep3(slurmConfig);
    }

    if (err) {
      setValidationError(err);
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setStep(step + 1);
      setError('');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      setSubmitPhase('creating');

      if (workflowMode === 'mesh_only') {
        // Create + submit a standalone Mesh. Solver runs separately later.
        const res = await api.post('/meshes', {
          name,
          geometry_id: geometryId,
          group_id: groupId || undefined,
          cfd_mode: cfdMode,
          mesh_config: meshConfig,
          slurm_config: slurmConfig,
          output_path: outputPath,
        });
        const meshRecordId = res.data.id;
        setSubmitPhase('submitting');
        await api.post(`/meshes/${meshRecordId}/submit`);
        navigate(`/meshes/${meshRecordId}`);
        return;
      }

      // combined OR solve_from_mesh → create a Job (optionally with mesh_id)
      const jobRes = await api.post('/jobs', {
        name,
        geometry_id: geometryId,
        group_id: groupId || undefined,
        cfd_mode: cfdMode,
        mesh_id: workflowMode === 'solve_from_mesh' ? meshId : undefined,
        mesh_config: meshConfig,
        solver_config: solverConfig,
        slurm_config: slurmConfig,
      });

      const jobId = jobRes.data.id;

      setSubmitPhase('submitting');
      await api.post(`/jobs/${jobId}/submit`);

      navigate(`/jobs/${jobId}`);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Submission failed. Please try again.';
      setError(detail);
      setSubmitting(false);
      setSubmitPhase(null);
    }
  };

  const submitLabel = submitPhase === 'creating'
    ? 'Creating job...'
    : submitPhase === 'submitting'
    ? 'Submitting to cluster...'
    : 'Submit Simulation';

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

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1 text-sm text-rose-500">{error}</div>
          <button onClick={() => setError('')} className="shrink-0 text-rose-500/60 hover:text-rose-500">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {validationError}
        </div>
      )}

      {/* Step content */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 animate-fade-in">
        {STEPS[step] === 'Geometry' && (
          <GeometryStep
            name={name}
            setName={setName}
            geometryId={geometryId}
            setGeometryId={setGeometryId}
            groupId={groupId}
            setGroupId={setGroupId}
            cfdMode={cfdMode}
            setCfdMode={handleModeChange}
            workflowMode={workflowMode}
            setWorkflowMode={handleWorkflowChange}
            meshId={meshId}
            setMeshId={setMeshId}
            outputPath={outputPath}
            setOutputPath={setOutputPath}
          />
        )}
        {STEPS[step] === 'Mesh' && <MeshConfigStep config={meshConfig} setConfig={setMeshConfig} />}
        {STEPS[step] === 'Solver' && <SolverConfigStep config={solverConfig} setConfig={setSolverConfig} cfdMode={cfdMode} />}
        {STEPS[step] === 'Resources' && <ResourceConfigStep config={slurmConfig} setConfig={setSlurmConfig} />}
        {STEPS[step] === 'Review' && (
          <ReviewStep
            name={name}
            geometryId={geometryId}
            cfdMode={cfdMode}
            meshConfig={meshConfig}
            solverConfig={solverConfig}
            slurmConfig={slurmConfig}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => { setStep(Math.max(0, step - 1)); setValidationError(''); }}
          disabled={step === 0}
          className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-medium disabled:opacity-30 hover:bg-[hsl(var(--accent))] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={handleNext}
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
            {submitting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {submitLabel}
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                {submitLabel}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
