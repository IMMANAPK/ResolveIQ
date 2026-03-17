import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiEscalationLog, ApiEscalationStep } from '@/types/api';

export function useEscalationHistory(complaintId: string) {
  return useQuery<ApiEscalationLog[]>({
    queryKey: ['escalation', complaintId],
    queryFn: async () => {
      const { data } = await api.get<ApiEscalationLog[]>(`/escalation/complaint/${complaintId}/history`);
      return data;
    },
    enabled: !!complaintId,
  });
}

export function useTriggerEscalation() {
  return useMutation({
    mutationFn: ({ notificationId, step }: { notificationId: string; step: ApiEscalationStep }) =>
      api.post(`/escalation/notification/${notificationId}/trigger`, { step }),
  });
}
