import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiAttachment } from "@/types/api";

export function useAttachments(complaintId: string) {
  return useQuery({
    queryKey: ["attachments", complaintId],
    queryFn: async () => {
      const { data } = await api.get<ApiAttachment[]>(`/complaints/${complaintId}/attachments`);
      return data;
    },
    enabled: !!complaintId,
  });
}

export function useUploadAttachment(complaintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<ApiAttachment>(
        `/complaints/${complaintId}/attachments`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attachments", complaintId] }),
  });
}

export function useDeleteAttachment(complaintId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      await api.delete(`/complaints/${complaintId}/attachments/${attachmentId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attachments", complaintId] }),
  });
}
