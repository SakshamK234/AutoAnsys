import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import api, { errorText } from '../lib/api';
import { useGeometries, useMeshes, useProfile } from '../lib/queries';
import { formatBytes, formatCells } from '../lib/format';
import { PageHeader } from '../components/chrome';
import { Button, Field, Input, Loading, Panel, Select, useToast } from '../components/ui';
import { Stripe } from '../components/livery';
import type { CfdMode, Job, Mesh, MeshConfig, SlurmConfig, SolverConfig } from '../types';

type Pipeline = 'combined' | 'mesh_only' | 'solve_from_mesh';

const STEPS = ['Setup', 'Physics', 'Mesh', 'Resources', 'Review'] as const;

interface Draft {
  name: string;
  cfd_mode: CfdMode;
  pipeline: Pipeline;
  geometry_id: string;
  mesh_id: string;
  group_id: string;
  solver: SolverConfig | null;
  mesh: MeshConfig | null;
  slurm: SlurmConfig | null;
}

export default function NewRunPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const prefill = (location.state as { template?: Record<string, unknown> } | null)?.template;

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    name: '',
    cfd_mode: (prefill?.cfd_mode as CfdMode) ?? 'individual_part',
    pipeline: 'combined',
    geometry_id: '',
    mesh_id: '',
    group_id: '',
    solver: (prefill?.solver as SolverConfig) ?? null,
    mesh: (prefill?.mesh as MeshConfig) ?? null,
    slurm: (prefill?.slurm as SlurmConfig) ?? null,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const geometries = useGeometries();
  const meshes = useMeshes('completed');
  const profile = useProfile(draft.cfd_mode);

  // Seed editable configs from the backend's resolved profile — the single
  // source of truth for what will actually run (never a hand-written mirror).
  useEffect(() => {
    if (!profile.data) return;
    setDraft((d) => ({
      ...d,
      solver: d.solver ?? structuredClone(profile.data.defaults.solver),
      mesh: d.mesh ?? structuredClone(profile.data.defaults.mesh),
      slurm: d.slurm ?? structuredClone(profile.data.defaults.slurm),
    }));
  }, [profile.data]);

  const setSolver = (fn: (s: SolverConfig) => void) =>
    setDraft((d) => {
      if (!d.solver) return d;
      const s = structuredClone(d.solver);
      fn(s);
      return { ...d, solver: s };
    });
  const setMesh = (fn: (m: MeshConfig) => void) =>
    setDraft((d) => {
      if (!d.mesh) return d;
      const m = structuredClone(d.mesh);
      fn(m);
      return { ...d, mesh: m };
    });
  const setSlurm = (fn: (s: SlurmConfig) => void) =>
    setDraft((d) => {
      if (!d.slurm) return d;
      const s = structuredClone(d.slurm);
      fn(s);
      return { ...d, slurm: s };
    });

  function switchMode(mode: CfdMode) {
    // Changing profile re-seeds physics/mesh/resources from that profile.
    setDraft((d) => ({ ...d, cfd_mode: mode, solver: null, mesh: null, slurm: null }));
  }

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return (
          draft.name.trim().length > 0 &&
          (draft.pipeline === 'solve_from_mesh' ? Boolean(draft.mesh_id) : Boolean(draft.geometry_id))
        );
      case 1:
        return Boolean(draft.solver) && (draft.solver?.convergence.max_iterations ?? 0) > 0;
      case 3:
        return Boolean(draft.slurm);
      default:
        return true;
    }
  }, [step, draft]);

  async function submit(asDraft: boolean) {
    if (!draft.solver || !draft.mesh || !draft.slurm) return;
    setBusy(true);
    setError(null);
    try {
      if (draft.pipeline === 'mesh_only') {
        const { data: mesh } = await api.post<Mesh>('/meshes', {
          geometry_id: draft.geometry_id,
          name: draft.name,
          cfd_mode: draft.cfd_mode,
          group_id: draft.group_id || null,
          mesh_config: draft.mesh,
          slurm_config: draft.slurm,
        });
        if (!asDraft) await api.post(`/meshes/${mesh.id}/submit`);
        toast('ok', asDraft ? 'Mesh saved as draft' : 'Mesh submitted');
        navigate(`/meshes/${mesh.id}`);
        return;
      }
      const payload: Record<string, unknown> = {
        geometry_id:
          draft.pipeline === 'solve_from_mesh'
            ? meshes.data?.items.find((m) => m.id === draft.mesh_id)?.geometry_id
            : draft.geometry_id,
        name: draft.name,
        cfd_mode: draft.cfd_mode,
        group_id: draft.group_id || null,
        solver_config: draft.solver,
        mesh_config: draft.mesh,
        slurm_config: draft.slurm,
      };
      if (draft.pipeline === 'solve_from_mesh') payload.mesh_id = draft.mesh_id;
      const { data: job } = await api.post<Job>('/jobs', payload);
      if (!asDraft) {
        try {
          await api.post(`/jobs/${job.id}/submit`);
        } catch (e) {
          // Job exists as a draft — send the user there instead of letting a
          // retry create a duplicate.
          toast('error', `Created as draft — submit failed: ${errorText(e)}`);
          navigate(`/runs/${job.id}`);
          return;
        }
      }
      toast('ok', asDraft ? 'Run saved as draft' : 'Run submitted to the cluster');
      navigate(`/runs/${job.id}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const ready = draft.solver && draft.mesh && draft.slurm;

  return (
    <div className="settle mx-auto max-w-3xl">
      <PageHeader title="New run" sub="Profile defaults come from the team SOP — override only what you mean to." />

      {/* Step rail */}
      <ol className="mb-6 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-1">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={clsx(
                'font-condensed w-full cursor-pointer border px-2 py-1.5 text-[11px] font-bold tracking-[0.1em] uppercase',
                i === step && 'border-ink bg-ink text-white',
                i < step && 'border-ok/40 bg-ok-tint text-ok',
                i > step && 'cursor-default border-seam bg-ground text-ink-3',
              )}
            >
              {i + 1} · {s}
            </button>
          </li>
        ))}
      </ol>

      {!ready && profile.isLoading ? (
        <Loading label="Loading profile defaults" />
      ) : (
        <Panel className="p-6">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <Field label="Run name">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. RW v1.5 — gurney +2mm"
                  autoFocus
                />
              </Field>

              <Field label="Run profile" hint="Sets SOP physics, mesh recipe, iterations, and resources.">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['individual_part', 'Individual part', 'Wing, undertray, single component in the SOP tunnel.'],
                      ['full_car', 'Full car', 'Half-car with moving ground + rotating wheels.'],
                    ] as const
                  ).map(([mode, label, hint]) => (
                    <button
                      key={mode}
                      onClick={() => switchMode(mode)}
                      className={clsx(
                        'cursor-pointer border p-3 text-left transition-colors',
                        draft.cfd_mode === mode ? 'border-race bg-race-tint' : 'border-seam hover:border-seam-strong',
                      )}
                    >
                      <span className="font-condensed block text-[13px] font-bold tracking-[0.08em] uppercase">
                        {label}
                      </span>
                      <span className="mt-1 block text-xs text-ink-3">{hint}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Pipeline">
                <Select
                  value={draft.pipeline}
                  onChange={(e) => setDraft((d) => ({ ...d, pipeline: e.target.value as Pipeline }))}
                >
                  <option value="combined">Mesh + solve (one job)</option>
                  <option value="mesh_only">Mesh only (reusable mesh artifact)</option>
                  <option value="solve_from_mesh">Solve from an existing mesh</option>
                </Select>
              </Field>

              {draft.pipeline === 'solve_from_mesh' ? (
                <Field label="Mesh" hint="Completed meshes only.">
                  <Select value={draft.mesh_id} onChange={(e) => setDraft((d) => ({ ...d, mesh_id: e.target.value }))}>
                    <option value="">Select a mesh…</option>
                    {meshes.data?.items.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {formatCells(m.cell_count)} cells
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field label="Geometry" hint="Parasolid (.x_t) recommended — export per the SOP.">
                  <Select
                    value={draft.geometry_id}
                    onChange={(e) => setDraft((d) => ({ ...d, geometry_id: e.target.value }))}
                  >
                    <option value="">Select a geometry…</option>
                    {geometries.data?.items.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.component_name || g.original_name} · {formatBytes(g.file_size)}
                      </option>
                    ))}
                  </Select>
                  {!geometries.data?.items.length && !geometries.isLoading && (
                    <p className="mt-2 text-sm text-ink-3">
                      No geometries yet —{' '}
                      <Link to="/geometries" className="text-race hover:underline">
                        upload one first
                      </Link>
                      .
                    </p>
                  )}
                </Field>
              )}
            </div>
          )}

          {step === 1 && draft.solver && (
            <PhysicsStep solver={draft.solver} setSolver={setSolver} />
          )}

          {step === 2 && draft.mesh && (
            <MeshStep
              mesh={draft.mesh}
              setMesh={setMesh}
              disabled={draft.pipeline === 'solve_from_mesh'}
            />
          )}

          {step === 3 && draft.slurm && <ResourcesStep slurm={draft.slurm} setSlurm={setSlurm} />}

          {step === 4 && ready && <ReviewStep draft={draft} />}

          {error && (
            <p role="alert" className="mt-4 border border-crit/40 bg-crit-tint px-3 py-2 text-sm text-crit">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-seam pt-4">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              ← Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" disabled={!stepValid || !ready} onClick={() => setStep((s) => s + 1)}>
                Continue →
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button busy={busy} onClick={() => submit(true)}>
                  Save draft
                </Button>
                <Button variant="primary" busy={busy} onClick={() => submit(false)}>
                  Submit to cluster
                </Button>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ── Step 1: physics ─────────────────────────────────────────────────── */

function PhysicsStep({ solver, setSolver }: { solver: SolverConfig; setSolver: (fn: (s: SolverConfig) => void) => void }) {
  const [advanced, setAdvanced] = useState(false);
  const inlet = solver.boundary_conditions.velocity_inlets[0];
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Freestream velocity (m/s)" hint="SOP: 15.65 m/s (35 mph).">
          <Input
            type="number"
            step="0.01"
            value={inlet?.velocity ?? ''}
            onChange={(e) =>
              setSolver((s) => {
                const v = Number(e.target.value);
                s.boundary_conditions.velocity_inlets.forEach((i) => (i.velocity = v));
                s.boundary_conditions.translating_walls.forEach((w) => (w.velocity_mps = v));
                s.reference_values.velocity_mps = v;
              })
            }
          />
        </Field>
        <Field label="Iterations">
          <Input
            type="number"
            value={solver.convergence.max_iterations}
            onChange={(e) => setSolver((s) => (s.convergence.max_iterations = Number(e.target.value)))}
          />
        </Field>
        <Field label="Reference area (m²)" hint="Full frontal area — coefficients scale with it.">
          <Input
            type="number"
            step="0.001"
            value={solver.reference_values.area_m2}
            onChange={(e) => setSolver((s) => (s.reference_values.area_m2 = Number(e.target.value)))}
          />
        </Field>
        <Field label="Reference length (m)">
          <Input
            type="number"
            step="0.001"
            value={solver.reference_values.length_m}
            onChange={(e) => setSolver((s) => (s.reference_values.length_m = Number(e.target.value)))}
          />
        </Field>
      </div>

      <div className="border border-seam bg-ground px-4 py-3 text-sm text-ink-2">
        <span className="font-condensed mr-2 text-[11px] font-bold tracking-[0.12em] text-ink-3 uppercase">
          From the profile
        </span>
        {solver.turbulence.model}
        {solver.turbulence.curvature_correction ? ' + curvature correction' : ''} ·{' '}
        {solver.symmetry.half_model ? `half model (forces ×${solver.symmetry.force_factor})` : 'full model'} · force
        scope “{solver.reporting.body_wall_pattern}”
      </div>

      <button
        className="font-condensed flex cursor-pointer items-center gap-1 text-[12px] font-bold tracking-[0.1em] text-race uppercase"
        onClick={() => setAdvanced((v) => !v)}
      >
        <ChevronDown size={14} className={clsx('transition-transform', advanced && 'rotate-180')} />
        Advanced physics
      </button>
      {advanced && (
        <div className="grid grid-cols-2 gap-4 border-l-2 border-seam pl-4">
          <Field label="Residual target">
            <Input
              type="number"
              step="1e-5"
              value={solver.convergence.residual_target}
              onChange={(e) => setSolver((s) => (s.convergence.residual_target = Number(e.target.value)))}
            />
          </Field>
          <Field label="Turbulence model">
            <Select
              value={solver.turbulence.model}
              onChange={(e) => setSolver((s) => (s.turbulence.model = e.target.value))}
            >
              <option value="k-omega-sst">k-ω SST</option>
              <option value="k-epsilon-realizable">k-ε realizable</option>
              <option value="spalart-allmaras">Spalart–Allmaras</option>
            </Select>
          </Field>
          <Field label="Body wall pattern" hint="Zones forces integrate over.">
            <Input
              value={solver.reporting.body_wall_pattern}
              onChange={(e) => setSolver((s) => (s.reporting.body_wall_pattern = e.target.value))}
            />
          </Field>
          <Field label="Initialization">
            <Select
              value={solver.initialization}
              onChange={(e) => setSolver((s) => (s.initialization = e.target.value))}
            >
              <option value="hybrid">Hybrid</option>
              <option value="hybrid-absolute">Hybrid (absolute)</option>
              <option value="standard">Standard</option>
            </Select>
          </Field>
        </div>
      )}
    </div>
  );
}

/* ── Step 2: mesh ────────────────────────────────────────────────────── */

function MeshStep({
  mesh,
  setMesh,
  disabled,
}: {
  mesh: MeshConfig;
  setMesh: (fn: (m: MeshConfig) => void) => void;
  disabled: boolean;
}) {
  const [advanced, setAdvanced] = useState(false);
  if (disabled)
    return (
      <p className="py-6 text-center text-sm text-ink-3">
        Solving from an existing mesh — the mesh recipe is already baked into the case file.
      </p>
    );
  const unit = mesh.geometry_unit;
  return (
    <div className="flex flex-col gap-5">
      <div className="border border-seam bg-ground px-4 py-3 text-sm text-ink-2">
        <span className="font-condensed mr-2 text-[11px] font-bold tracking-[0.12em] text-ink-3 uppercase">
          Recipe
        </span>
        {mesh.workflow === 'fault-tolerant'
          ? 'Fault-tolerant wrap (cluster-validated) — classifier names the tunnel boundaries automatically.'
          : 'Watertight workflow — expects a clean, labelled export.'}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`Surface min size (${unit})`}>
          <Input
            type="number"
            step="0.1"
            value={mesh.surface_mesh.min_size}
            onChange={(e) => setMesh((m) => (m.surface_mesh.min_size = Number(e.target.value)))}
          />
        </Field>
        <Field label={`Surface max size (${unit})`}>
          <Input
            type="number"
            step="1"
            value={mesh.surface_mesh.max_size}
            onChange={(e) => setMesh((m) => (m.surface_mesh.max_size = Number(e.target.value)))}
          />
        </Field>
        <Field label="Prism layers">
          <Input
            type="number"
            value={mesh.volume_mesh.num_layers}
            onChange={(e) => setMesh((m) => (m.volume_mesh.num_layers = Number(e.target.value)))}
          />
        </Field>
        <Field label="First layer height (mm)" hint="Leave empty for the proven SOP default; set for y+ ≈ 1.">
          <Input
            type="number"
            step="0.001"
            value={mesh.volume_mesh.first_layer_height_mm ?? ''}
            placeholder="SOP default"
            onChange={(e) =>
              setMesh((m) => (m.volume_mesh.first_layer_height_mm = e.target.value === '' ? null : Number(e.target.value)))
            }
          />
        </Field>
      </div>
      <button
        className="font-condensed flex cursor-pointer items-center gap-1 text-[12px] font-bold tracking-[0.1em] text-race uppercase"
        onClick={() => setAdvanced((v) => !v)}
      >
        <ChevronDown size={14} className={clsx('transition-transform', advanced && 'rotate-180')} />
        Advanced mesh
      </button>
      {advanced && (
        <div className="grid grid-cols-2 gap-4 border-l-2 border-seam pl-4">
          <Field label="Workflow">
            <Select
              value={mesh.workflow}
              onChange={(e) => setMesh((m) => (m.workflow = e.target.value as MeshConfig['workflow']))}
            >
              <option value="fault-tolerant">Fault-tolerant wrap</option>
              <option value="watertight">Watertight</option>
            </Select>
          </Field>
          <Field label="Growth rate">
            <Input
              type="number"
              step="0.05"
              value={mesh.surface_mesh.growth_rate}
              onChange={(e) =>
                setMesh((m) => {
                  m.surface_mesh.growth_rate = Number(e.target.value);
                  m.volume_mesh.growth_rate = Number(e.target.value);
                })
              }
            />
          </Field>
          <Field label={`Max cell length (m)`}>
            <Input
              type="number"
              step="0.01"
              value={mesh.volume_mesh.max_cell_length}
              onChange={(e) => setMesh((m) => (m.volume_mesh.max_cell_length = Number(e.target.value)))}
            />
          </Field>
          <Field label="Curvature normal angle (°)">
            <Input
              type="number"
              step="1"
              value={mesh.surface_mesh.curvature_normal_angle}
              onChange={(e) => setMesh((m) => (m.surface_mesh.curvature_normal_angle = Number(e.target.value)))}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

/* ── Step 3: resources ───────────────────────────────────────────────── */

function ResourcesStep({ slurm, setSlurm }: { slurm: SlurmConfig; setSlurm: (fn: (s: SlurmConfig) => void) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nodes">
          <Input
            type="number"
            min={1}
            max={4}
            value={slurm.nodes}
            onChange={(e) => setSlurm((s) => (s.nodes = Number(e.target.value)))}
          />
        </Field>
        <Field label="Cores per node">
          <Input
            type="number"
            min={1}
            max={128}
            value={slurm.cores_per_node}
            onChange={(e) => setSlurm((s) => (s.cores_per_node = Number(e.target.value)))}
          />
        </Field>
        <Field label="Memory (GB)">
          <Input
            type="number"
            min={16}
            max={240}
            value={slurm.memory_gb}
            onChange={(e) => setSlurm((s) => (s.memory_gb = Number(e.target.value)))}
          />
        </Field>
        <Field label="Walltime (hours)">
          <Input
            type="number"
            min={1}
            max={96}
            value={slurm.walltime_hours}
            onChange={(e) => setSlurm((s) => (s.walltime_hours = Number(e.target.value)))}
          />
        </Field>
        <Field label="Partition">
          <Select value={slurm.partition} onChange={(e) => setSlurm((s) => (s.partition = e.target.value))}>
            <option value="normal_q">normal_q</option>
            <option value="preemptable_q">preemptable_q</option>
          </Select>
        </Field>
        <Field label="Job name (squeue)">
          <Input value={slurm.job_name} onChange={(e) => setSlurm((s) => (s.job_name = e.target.value))} />
        </Field>
      </div>
      <p className="text-xs text-ink-3">
        The SLURM account is pinned to the team allocation server-side. Meshing stages are automatically capped at
        16 cores — past that MPI overhead makes wall-clock worse.
      </p>
    </div>
  );
}

/* ── Step 4: review ──────────────────────────────────────────────────── */

function ReviewStep({ draft }: { draft: Draft }) {
  const s = draft.solver!;
  const m = draft.mesh!;
  const r = draft.slurm!;
  const rows: [string, string][] = [
    ['Run', draft.name],
    ['Profile', draft.cfd_mode === 'full_car' ? 'Full car' : 'Individual part'],
    [
      'Pipeline',
      draft.pipeline === 'combined'
        ? 'Mesh + solve'
        : draft.pipeline === 'mesh_only'
          ? 'Mesh only'
          : 'Solve from existing mesh',
    ],
    ['Freestream', `${s.boundary_conditions.velocity_inlets[0]?.velocity ?? '—'} m/s`],
    ['Turbulence', `${s.turbulence.model}${s.turbulence.curvature_correction ? ' + CC' : ''}`],
    ['Iterations', String(s.convergence.max_iterations)],
    ['Reference', `A ${s.reference_values.area_m2} m² · L ${s.reference_values.length_m} m · ρ ${s.reference_values.density_kg_m3}`],
    ['Symmetry', s.symmetry.half_model ? `half model · ×${s.symmetry.force_factor}` : 'full model'],
    ['Boundary conditions', bcSummary(s)],
    ['Mesh', draft.pipeline === 'solve_from_mesh' ? 'from selected mesh' : `${m.workflow} · surf ${m.surface_mesh.min_size}–${m.surface_mesh.max_size} ${m.geometry_unit} · ${m.volume_mesh.num_layers} prism layers`],
    ['Resources', `${r.nodes}×${r.cores_per_node} cores · ${r.memory_gb} GB · ${r.walltime_hours} h · ${r.partition}`],
  ];
  return (
    <div className="flex items-stretch gap-0 border border-seam">
      <Stripe id={draft.name || 'draft'} />
      <dl className="flex-1 divide-y divide-seam">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-4 px-4 py-2.5">
            <dt className="font-condensed w-44 shrink-0 text-[11px] leading-5 font-bold tracking-[0.12em] text-ink-3 uppercase">
              {k}
            </dt>
            <dd className="font-mono tnum text-[13px]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function bcSummary(s: SolverConfig): string {
  const bc = s.boundary_conditions;
  const parts: string[] = [];
  if (bc.velocity_inlets.length) parts.push(`${bc.velocity_inlets.map((b) => b.zone_name).join(',')} inlet`);
  if (bc.pressure_outlets.length) parts.push(`${bc.pressure_outlets.map((b) => b.zone_name).join(',')} outlet`);
  if (bc.translating_walls.length) parts.push('moving ground');
  if (bc.rotating_walls.length) parts.push(`${bc.rotating_walls.length} rotating wheels`);
  if (bc.symmetry_planes.length) parts.push('symmetry');
  if (bc.slip_walls.length) parts.push(`${bc.slip_walls.length} slip walls`);
  return parts.join(' · ') || 'profile defaults applied at submit';
}
