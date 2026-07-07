import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DEFAULT_MESH_CONFIG, DEFAULT_SOLVER_CONFIG, DEFAULT_SLURM_CONFIG } from '@/lib/constants';
import { MeshConfigStep } from '@/components/wizard/mesh-config-step';
import { SolverConfigStep } from '@/components/wizard/solver-config-step';
import { ResourceConfigStep } from '@/components/wizard/resource-config-step';
import { ArrowLeft, Save, Rocket, Share2, Pencil, Check } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { SimulationTemplate, MeshConfig, SolverConfig, SlurmConfig } from '@/types';

const CONFIG_TABS = ['Mesh', 'Solver', 'Resources'] as const;

function deepMerge<T extends Record<string, any>>(defaults: T, overrides: Partial<T> | undefined | null): T {
  if (!overrides) return { ...defaults };
  const result: any = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (overrides[key] !== undefined) {
      if (
        typeof defaults[key] === 'object' &&
        defaults[key] !== null &&
        !Array.isArray(defaults[key]) &&
        typeof overrides[key] === 'object' &&
        overrides[key] !== null &&
        !Array.isArray(overrides[key])
      ) {
        result[key] = deepMerge(defaults[key], overrides[key] as any);
      } else {
        result[key] = overrides[key];
      }
    }
  }
  return result;
}

export function TemplateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: async () => {
      const res = await api.get<SimulationTemplate>(`/templates/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const updateTemplate = useMutation({
    mutationFn: async (data: { name: string; description?: string; config: any; is_shared: boolean }) => {
      const res = await api.put<SimulationTemplate>(`/templates/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template', id] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
  });

  const [activeTab, setActiveTab] = useState<string>('Mesh');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [meshConfig, setMeshConfig] = useState<MeshConfig>(DEFAULT_MESH_CONFIG);
  const [solverConfig, setSolverConfig] = useState<SolverConfig>(DEFAULT_SOLVER_CONFIG);
  const [slurmConfig, setSlurmConfig] = useState<SlurmConfig>(DEFAULT_SLURM_CONFIG);
  const [initialized, setInitialized] = useState(false);

  // Initialize state from template data
  useEffect(() => {
    if (template && !initialized) {
      setNameInput(template.name);
      setDescInput(template.description || '');
      setIsShared(template.is_shared);

      const cfg = template.config || {};
      setMeshConfig(deepMerge(DEFAULT_MESH_CONFIG, cfg.mesh));
      setSolverConfig(deepMerge(DEFAULT_SOLVER_CONFIG, cfg.solver));
      setSlurmConfig(deepMerge(DEFAULT_SLURM_CONFIG, cfg.slurm));
      setInitialized(true);
    }
  }, [template, initialized]);

  const handleSave = () => {
    updateTemplate.mutate({
      name: nameInput.trim() || template?.name || 'Untitled',
      description: descInput.trim() || undefined,
      config: {
        mesh: meshConfig,
        solver: solverConfig,
        slurm: slurmConfig,
      },
      is_shared: isShared,
    });
  };

  const handleUseTemplate = () => {
    const config = {
      mesh: meshConfig,
      solver: solverConfig,
      slurm: slurmConfig,
    };
    navigate('/new-job', { state: { templateConfig: config, templateName: nameInput } });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Template not found.</p>
        <button onClick={() => navigate('/templates')} className="mt-2 text-sm font-medium text-[hsl(var(--primary))] hover:underline">
          Back to templates
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/templates')}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to templates
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="text-2xl font-bold tracking-tight bg-transparent border-b-2 border-[hsl(var(--primary))] outline-none"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); }}
              />
              <button onClick={() => setEditingName(false)} className="rounded-lg p-1 hover:bg-[hsl(var(--accent))]">
                <Check className="h-4 w-4 text-emerald-500" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{nameInput}</h1>
              <button onClick={() => setEditingName(true)} className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1">
            <input
              type="text"
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              placeholder="Add a description..."
              className="text-sm text-[hsl(var(--muted-foreground))] bg-transparent outline-none placeholder:text-[hsl(var(--muted-foreground)/0.5)] w-full max-w-md"
            />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-[hsl(var(--muted-foreground))]">
            <span>v{template.version}</span>
            <span>&middot;</span>
            <span>{formatDate(template.created_at)}</span>
            <label className="flex items-center gap-1.5 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="rounded"
              />
              <Share2 className="h-3 w-3" />
              <span>Shared</span>
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={updateTemplate.isPending}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]'
            )}
          >
            {saveSuccess ? (
              <><Check className="h-3.5 w-3.5" /> Saved</>
            ) : updateTemplate.isPending ? (
              <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Saving...</>
            ) : (
              <><Save className="h-3.5 w-3.5" /> Save</>
            )}
          </button>
          <button
            onClick={handleUseTemplate}
            className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 active:brightness-95 transition-all"
          >
            <Rocket className="h-3.5 w-3.5" />
            Use Template
          </button>
        </div>
      </div>

      {/* Config tabs */}
      <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1 w-fit">
        {CONFIG_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-md px-4 py-1.5 text-xs font-medium transition-all',
              activeTab === tab
                ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Config editors */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        {activeTab === 'Mesh' && <MeshConfigStep config={meshConfig} setConfig={setMeshConfig} />}
        {activeTab === 'Solver' && <SolverConfigStep config={solverConfig} setConfig={setSolverConfig} />}
        {activeTab === 'Resources' && <ResourceConfigStep config={slurmConfig} setConfig={setSlurmConfig} />}
      </div>

      {/* Update error */}
      {updateTemplate.isError && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-500">
          Failed to save template. Please try again.
        </div>
      )}
    </div>
  );
}
