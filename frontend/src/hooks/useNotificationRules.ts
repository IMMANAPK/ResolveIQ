import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiNotificationRule } from '@/types/api';

export function useNotificationRules(committeeId: string) {
  return useQuery({
    queryKey: ['notification-rules', committeeId],
    queryFn: () => api.get<ApiNotificationRule[]>(`/committees/${committeeId}/notification-rules`).then(r => r.data),
    enabled: !!committeeId,
  });
}

export function useCreateNotificationRule(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ApiNotificationRule>) =>
      api.post(`/committees/${committeeId}/notification-rules`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-rules', committeeId] }),
  });
}

export function useUpdateNotificationRule(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, ...data }: { ruleId: string } & Partial<ApiNotificationRule>) =>
      api.patch(`/committees/${committeeId}/notification-rules/${ruleId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-rules', committeeId] }),
  });
}

export function useDeleteNotificationRule(committeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      api.delete(`/committees/${committeeId}/notification-rules/${ruleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-rules', committeeId] }),
  });
}
