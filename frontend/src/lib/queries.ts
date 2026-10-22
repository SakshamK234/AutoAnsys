import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './api';
import type {
  CfdMode,
  ClusterStatus,
  ForcePoint,
  Geometry,
  Group,
  GroupDetail,
  Job,
  JobList,
  Mesh,
  MeshList,
  ProfileResponse,
  ResidualPoint,
  ResultFile,
  Template,
} from '../types';

const ACTIVE = new Set(['queued', 'running']);

/* ── Jobs ──────────────────────────────────────────────────────────────── */

export interface JobFilters {
  status?: string;
  search?: string;
  view?: 'mine' | 'group';
  group_id?: string;
  limit?: number;
  offset?: number;
}

export function useJobs(filters: JobFilters = {}) {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: filters.limit ?? 50, skip: filters.offset ?? 0 };
      if (filters.status && filters.status !== 'all') params.status_filter = filters.status;
      if (filters.search) params.search = filters.search;
      // Group view requires a concrete group id (the backend scopes by group).
      if (filters.view === 'group' && filters.group_id) params.group_id = filters.group_id;
      const { data } = await api.get<JobList>('/jobs', { params });
      return data;
    },
    refetchInterval: (q) =>
      q.state.data?.items.some((j) => ACTIVE.has(j.status)) ? 15_000 : false,
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: async () => (await api.get<Job>(`/jobs/${id}`)).data,
    enabled: Boolean(id),
    refetchInterval: (q) => (q.state.data && ACTIVE.has(q.state.data.status) ? 10_000 : false),
  });
}

export function useJobForces(id: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['job', id, 'forces'],
    queryFn: async () => (await api.get<ForcePoint[]>(`/jobs/${id}/forces`)).data,
    enabled: Boolean(id) && (status === 'completed' || status === 'failed'),
  });
}

export function useJobResiduals(id: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['job', id, 'residuals'],
    queryFn: async () => (await api.get<ResidualPoint[]>(`/jobs/${id}/residuals`)).data,
    enabled: Boolean(id) && (status === 'completed' || status === 'failed'),
  });
}

export function useJobFiles(id: string | undefined, status?: string) {
  return useQuery({
    queryKey: ['job', id, 'files'],
    queryFn: async () => (await api.get<ResultFile[]>(`/files/${id}`)).data,
    enabled: Boolean(id) && Boolean(status) && !ACTIVE.has(status!) && status !== 'draft',
  });
}

export async function fileDownloadUrl(jobId: string, fileId: string): Promise<string> {
  const { data } = await api.get<{ url: string }>(`/files/${jobId}/download/${fileId}`);
  return data.url;
}

export function useJobMutations(id?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['jobs'] });
    if (id) qc.invalidateQueries({ queryKey: ['job', id] });
  };
  return {
    submit: useMutation({
      mutationFn: (jobId: string) => api.post(`/jobs/${jobId}/submit`),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: (jobId: string) => api.post(`/jobs/${jobId}/cancel`),
      onSuccess: invalidate,
    }),
    sync: useMutation({
      mutationFn: (jobId: string) => api.post(`/jobs/${jobId}/sync`),
      onSuccess: invalidate,
    }),
    resubmit: useMutation({
      mutationFn: async (jobId: string) => (await api.post<Job>(`/jobs/${jobId}/resubmit`)).data,
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (jobId: string) => api.delete(`/jobs/${jobId}`),
      onSuccess: invalidate,
    }),
  };
}

/* ── Meshes ───────────────────────────────────────────────────────────── */

export function useMeshes(status?: string) {
  return useQuery({
    queryKey: ['meshes', status ?? 'all'],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 100 };
      if (status && status !== 'all') params.status = status;
      const { data } = await api.get<MeshList>('/meshes', { params });
      return data;
    },
    refetchInterval: (q) =>
      q.state.data?.items.some((m) => ACTIVE.has(m.status)) ? 15_000 : false,
  });
}

export function useMesh(id: string | undefined) {
  return useQuery({
    queryKey: ['mesh', id],
    queryFn: async () => (await api.get<Mesh>(`/meshes/${id}`)).data,
    enabled: Boolean(id),
    refetchInterval: (q) => (q.state.data && ACTIVE.has(q.state.data.status) ? 10_000 : false),
    retry: (count, err: unknown) =>
      (err as { response?: { status?: number } })?.response?.status === 404 ? false : count < 2,
  });
}

export function useMeshMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['meshes'] });
    qc.invalidateQueries({ queryKey: ['mesh'] });
  };
  return {
    submit: useMutation({ mutationFn: (id: string) => api.post(`/meshes/${id}/submit`), onSuccess: invalidate }),
    cancel: useMutation({ mutationFn: (id: string) => api.post(`/meshes/${id}/cancel`), onSuccess: invalidate }),
    sync: useMutation({ mutationFn: (id: string) => api.post(`/meshes/${id}/sync`), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => api.delete(`/meshes/${id}`), onSuccess: invalidate }),
  };
}

/* ── Geometries ───────────────────────────────────────────────────────── */

export function useGeometries() {
  return useQuery({
    queryKey: ['geometries'],
    queryFn: async () => (await api.get<{ items: Geometry[]; total: number }>('/geometries')).data,
  });
}

export function useGeometryMutations() {
  const qc = useQueryClient();
  return {
    upload: useMutation({
      mutationFn: async (payload: { file: File; component_name?: string; description?: string }) => {
        const form = new FormData();
        form.append('file', payload.file);
        if (payload.component_name) form.append('component_name', payload.component_name);
        if (payload.description) form.append('description', payload.description);
        return (await api.post<Geometry>('/geometries/upload', form)).data;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['geometries'] }),
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/geometries/${id}`),
      onSuccess: () => qc.invalidateQueries({ queryKey: ['geometries'] }),
    }),
  };
}

export async function geometryDownloadUrl(id: string): Promise<string> {
  const { data } = await api.get<{ url: string }>(`/geometries/${id}/download`);
  return data.url;
}

/* ── Groups ───────────────────────────────────────────────────────────── */

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.get<Group[]>('/groups')).data,
  });
}

export function useGroup(id: string | undefined) {
  return useQuery({
    queryKey: ['group', id],
    queryFn: async () => (await api.get<GroupDetail>(`/groups/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useGroupMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['groups'] });
  return {
    create: useMutation({
      mutationFn: async (payload: { name: string; description?: string }) =>
        (await api.post<Group>('/groups', payload)).data,
      onSuccess: invalidate,
    }),
    join: useMutation({
      mutationFn: async (invite_code: string) =>
        (await api.post<Group>('/groups/join', { invite_code })).data,
      onSuccess: invalidate,
    }),
  };
}

/* ── Templates ────────────────────────────────────────────────────────── */

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => (await api.get<Template[]>('/templates')).data,
  });
}

export function useTemplateMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['templates'] });
  return {
    create: useMutation({
      mutationFn: async (payload: {
        name: string;
        description?: string;
        config: Record<string, unknown>;
        is_shared?: boolean;
      }) => (await api.post<Template>('/templates', payload)).data,
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: async (payload: { id: string; body: Partial<Template> }) =>
        (await api.put<Template>(`/templates/${payload.id}`, payload.body)).data,
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/templates/${id}`),
      onSuccess: invalidate,
    }),
  };
}

/* ── Profiles & cluster ───────────────────────────────────────────────── */

export function useProfile(mode: CfdMode) {
  return useQuery({
    queryKey: ['profile', mode],
    queryFn: async () => (await api.get<ProfileResponse>(`/profiles/${mode}`)).data,
    staleTime: 10 * 60 * 1000,
  });
}

export function useClusterStatus() {
  return useQuery({
    queryKey: ['cluster-status'],
    queryFn: async () => (await api.get<ClusterStatus>('/cluster/status')).data,
    refetchInterval: 60_000,
  });
}
