import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiComment, ApiCommentPage } from '@/types/api';

// useInfiniteQuery accumulates pages client-side — correct for "load more" pattern
export function useComments(complaintId: string) {
  return useInfiniteQuery<ApiCommentPage>({
    queryKey: ['comments', complaintId],
    queryFn: ({ pageParam = 1 }) =>
      api
        .get(`/complaints/${complaintId}/comments?page=${pageParam}&limit=20`)
        .then(r => r.data),
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.limit < lastPage.total ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!complaintId,
  });
}

export function usePostComment(complaintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { body: string; isInternal?: boolean }) =>
      api
        .post<ApiComment>(`/complaints/${complaintId}/comments`, data)
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', complaintId] }),
  });
}

export function useDeleteComment(complaintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api
        .delete(`/complaints/${complaintId}/comments/${commentId}`)
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', complaintId] }),
  });
}

export function useUpdateComplaintStatus(complaintId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      status: string;
      resolutionNotes?: string;
      notifyComplainant?: boolean;
    }) =>
      api
        .patch(`/complaints/${complaintId}/status`, data)
        .then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['complaints', complaintId] }),
  });
}
