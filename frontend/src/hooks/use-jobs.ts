import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Job, JobListResponse, ForceReport, ResidualData } from '@/types';

interface JobFilters {
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
  group_id?: string;
}

export function useJobs(filters: JobFilters = {}) {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status_filter', filters.status);
      if (filters.search) params.set('search', filters.search);
      if (filters.skip) params.set('skip', String(filters.skip));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.group_id) params.set('group_id', filters.group_id);
      const res = await api.get<JobListResponse>(`/jobs?${params}`);
      return res.data;
    },
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: async () => {
      const res = await api.get<Job>(`/jobs/${id}`);
      return res.data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling once job reaches a terminal state
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return false;
      }
      return 5000;
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      geometry_id: string;
      mesh_config: any;
      solver_config: any;
      slurm_config: any;
    }) => {
      const res = await api.post<Job>('/jobs', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Job>(`/jobs/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useJobForces(id: string | undefined) {
  return useQuery({
    queryKey: ['jobs', id, 'forces'],
    queryFn: async () => {
      const res = await api.get<ForceReport[]>(`/jobs/${id}/forces`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useJobResiduals(id: string | undefined) {
  return useQuery({
    queryKey: ['jobs', id, 'residuals'],
    queryFn: async () => {
      const res = await api.get<ResidualData[]>(`/jobs/${id}/residuals`);
      return res.data;
    },
    enabled: !!id,
  });
}
