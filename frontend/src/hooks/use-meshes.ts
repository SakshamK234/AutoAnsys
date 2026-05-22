import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Mesh, MeshCreateRequest, MeshListResponse } from '@/types';

interface MeshFilters {
  status?: string;
  geometry_id?: string;
  group_id?: string;
  skip?: number;
  limit?: number;
}

export function useMeshes(filters: MeshFilters = {}) {
  return useQuery({
    queryKey: ['meshes', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status_filter', filters.status);
      if (filters.geometry_id) params.set('geometry_id', filters.geometry_id);
      if (filters.group_id) params.set('group_id', filters.group_id);
      if (filters.skip) params.set('skip', String(filters.skip));
      if (filters.limit) params.set('limit', String(filters.limit));
      const res = await api.get<MeshListResponse>(`/meshes?${params}`);
      return res.data;
    },
  });
}

export function useMesh(id: string | undefined) {
  return useQuery({
    queryKey: ['meshes', id],
    queryFn: async () => {
      const res = await api.get<Mesh>(`/meshes/${id}`);
      return res.data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (s === 'completed' || s === 'failed' || s === 'cancelled') return false;
      return 5000;
    },
  });
}

export function useCreateMesh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: MeshCreateRequest) => {
      const res = await api.post<Mesh>('/meshes', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meshes'] }),
  });
}

export function useSubmitMesh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Mesh>(`/meshes/${id}/submit`);
      return res.data;
    },
    onSuccess: (mesh) => {
      qc.setQueryData(['meshes', mesh.id], mesh);
      qc.invalidateQueries({ queryKey: ['meshes'] });
    },
  });
}

export function useSyncMesh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Mesh>(`/meshes/${id}/sync`);
      return res.data;
    },
    onSuccess: (mesh) => {
      qc.setQueryData(['meshes', mesh.id], mesh);
      qc.invalidateQueries({ queryKey: ['meshes'] });
    },
  });
}

export function useCancelMesh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Mesh>(`/meshes/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meshes'] }),
  });
}

export function useDeleteMesh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/meshes/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meshes'] }),
  });
}

/** POST /meshes/find_reusable — preview reuse before creating the mesh. */
export function useFindReusableMesh() {
  return useMutation({
    mutationFn: async (data: MeshCreateRequest) => {
      const res = await api.post<Mesh | null>('/meshes/find_reusable', data);
      return res.data;
    },
  });
}
