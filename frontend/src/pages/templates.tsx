import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { FileText, Plus, Sparkles, Trash2, Share2, Star, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { SimulationTemplate } from '@/types';

function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await api.get<SimulationTemplate[]>('/templates');
      return res.data;
    },
  });
}

function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; config: any; is_shared: boolean }) => {
      const res = await api.post<SimulationTemplate>('/templates', data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
}

function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/templates/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
}

function CreateTemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateTemplate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), description: description.trim() || undefined, config: {}, is_shared: isShared },
      {
        onSuccess: () => {
          setName('');
          setDescription('');
          setIsShared(false);
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">New Template</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Standard Wing Analysis"
              className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description..."
              className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Share with team</span>
          </label>

          {create.isError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-500">
              Failed to create template. Please try again.
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium hover:bg-[hsl(var(--accent))] transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || create.isPending}
              className="rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {create.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteTemplate.mutate(id, { onSuccess: () => setDeleteConfirm(null) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulation Templates</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Save and reuse simulation configurations
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110 active:brightness-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent" />
        </div>
      ) : !templates || templates.length === 0 ? (
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition-all hover:shadow-md hover:border-[hsl(var(--primary)/0.3)]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-[hsl(var(--primary)/0.1)] p-1.5">
                    <FileText className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                  </div>
                  <h3 className="font-semibold text-sm truncate max-w-[180px]">{t.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  {t.is_recommended && (
                    <Star className="h-3.5 w-3.5 text-amber-500" title="Recommended" />
                  )}
                  {t.is_shared && (
                    <Share2 className="h-3.5 w-3.5 text-blue-500" title="Shared" />
                  )}
                </div>
              </div>

              {t.description && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 line-clamp-2">{t.description}</p>
              )}

              <div className="flex items-center justify-between text-[10px] text-[hsl(var(--muted-foreground))]">
                <span>v{t.version} &middot; {formatDate(t.created_at)}</span>
                {deleteConfirm === t.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleteTemplate.isPending}
                      className="rounded px-2 py-0.5 text-[10px] font-medium bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                    >
                      {deleteTemplate.isPending ? '...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded px-2 py-0.5 text-[10px] font-medium hover:bg-[hsl(var(--accent))]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(t.id)}
                    className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-500 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTemplateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
