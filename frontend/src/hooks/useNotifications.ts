import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiNotification } from '@/types/api';

export function useNotifications() {
  return useQuery<ApiNotification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get<ApiNotification[]>('/notifications');
      return data;
    },
  });
}

export function useNotificationsForComplaint(complaintId: string) {
  return useQuery<ApiNotification[]>({
    queryKey: ['notifications', 'complaint', complaintId],
    queryFn: async () => {
      const { data } = await api.get<ApiNotification[]>(`/notifications/complaint/${complaintId}`);
      return data;
    },
    enabled: !!complaintId,
  });
}

export function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['notifications'] });
}
