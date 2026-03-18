import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiCommittee, ApiComplaintCategory } from '@/types/api';

export interface CommitteePayload {
  name: string;
  description?: string;
  categories: ApiComplaintCategory[];
  managerId?: string;
}

export function useCommittees() {
  return useQuery<ApiCommittee[]>({
    queryKey: ['committees'],
    queryFn: async () => {
      const { data } = await api.get<ApiCommittee[]>('/committees');
      return data;
    },
  });
}

export function useCreateCommittee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CommitteePayload) =>
      api.post<ApiCommittee>('/committees', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['committees'] }),
  });
}

export function useUpdateCommittee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: CommitteePayload & { id: string }) =>
      api.patch<ApiCommittee>(`/committees/${id}`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['committees'] }),
  });
}

export function useDeleteCommittee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/committees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['committees'] }),
  });
}
