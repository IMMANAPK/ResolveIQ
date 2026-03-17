import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiComplaint, ApiComplaintStatus } from '@/types/api';

export function useComplaints(status?: ApiComplaintStatus) {
  return useQuery<ApiComplaint[]>({
    queryKey: ['complaints', status],
    queryFn: async () => {
      const params = status ? { status } : {};
      const { data } = await api.get<ApiComplaint[]>('/complaints', { params });
      return data;
    },
  });
}

export function useComplaint(id: string) {
  return useQuery<ApiComplaint>({
    queryKey: ['complaints', id],
    queryFn: async () => {
      const { data } = await api.get<ApiComplaint>(`/complaints/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useUpdateComplaintStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, resolutionNotes }: { id: string; status: ApiComplaintStatus; resolutionNotes?: string }) =>
      api.patch(`/complaints/${id}/status`, { status, resolutionNotes }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['complaints'] });
      qc.invalidateQueries({ queryKey: ['complaints', id] });
    },
  });
}
