import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Geometry, GeometryList } from '@/types';

export function useGeometries() {
  return useQuery({
    queryKey: ['geometries'],
    queryFn: async () => {
      const res = await api.get<GeometryList>('/geometries');
      return res.data;
    },
  });
}

export function useUploadGeometry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      // Let axios set Content-Type (including the multipart boundary) automatically.
      // Manually setting 'multipart/form-data' strips the boundary and breaks parsing.
      const res = await api.post<Geometry>('/geometries/upload', formData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geometries'] });
    },
  });
}

export function useDeleteGeometry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/geometries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geometries'] });
    },
  });
}

export function useDownloadGeometry() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.get<{ url: string; filename: string }>(`/geometries/${id}/download`);
      return res.data;
    },
    onSuccess: (data) => {
      window.open(data.url, '_blank');
    },
  });
}
