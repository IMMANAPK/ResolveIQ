import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get('/admin/settings');
      return data as Record<string, any>;
    }
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const { data } = await api.put('/admin/settings', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    }
  });
}

export function useTestAi() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/admin/settings/test-ai');
      return data as { success: boolean, timeMs: number, summary?: string, error?: string };
    }
  });
}

export function useTestEmail() {
  return useMutation({
    mutationFn: async (payload: { to: string }) => {
      const { data } = await api.post('/admin/settings/test-email', payload);
      return data as { success: boolean, timeMs: number, error?: string };
    }
  });
}
