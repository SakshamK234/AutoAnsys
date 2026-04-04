import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { FEAJob, FEAJobListResponse, FEASubmitPayload } from '@/types/fea';

export function useFeaJobs(skip = 0, limit = 50) {
  return useQuery({
    queryKey: ['fea-jobs', skip, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('skip', String(skip));
      params.set('limit', String(limit));
      const res = await api.get<FEAJobListResponse>(`/fea/jobs?${params}`);
      return res.data;
    },
  });
}

export function useFeaJob(id: string | undefined) {
  return useQuery({
    queryKey: ['fea-jobs', id],
    queryFn: async () => {
      const res = await api.get<FEAJob>(`/fea/jobs/${id}`);
      return res.data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'pending' || status === 'queued' || status === 'running') {
        return 10_000;
      }
      return false;
    },
  });
}

export function useFeaJobLog(id: string | undefined) {
  return useQuery({
    queryKey: ['fea-jobs', id, 'log'],
    queryFn: async () => {
      const res = await api.get<string>(`/fea/log/${id}`);
      return res.data;
    },
    enabled: !!id,
    refetchInterval: 15_000,
  });
}

export function useSubmitFeaJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FEASubmitPayload) => {
      const res = await api.post<FEAJob>('/fea/submit', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fea-jobs'] });
    },
  });
}

export function useCancelFeaJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<FEAJob>(`/fea/cancel/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fea-jobs'] });
    },
  });
}
