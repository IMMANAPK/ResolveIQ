import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiFeedback } from "@/types/api";

export function useFeedback(complaintId: string) {
  return useQuery({
    queryKey: ["feedback", complaintId],
    queryFn: async () => {
      const { data } = await api.get<ApiFeedback | null>(
        `/complaints/${complaintId}/feedback`
      );
      return data;
    },
    enabled: !!complaintId,
  });
}

export function useSubmitFeedback(complaintId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { rating: number; comment?: string }) => {
      const { data } = await api.post<ApiFeedback>(
        `/complaints/${complaintId}/feedback`,
        body
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback", complaintId] });
    },
  });
}
