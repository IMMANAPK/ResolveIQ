import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiWorkflowDefinition, ApiWorkflowRun, ApiWorkflowStepLog } from '@/types/api';

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get<ApiWorkflowDefinition[]>('/admin/workflows').then(r => r.data),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: () => api.get<ApiWorkflowDefinition>(`/admin/workflows/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ApiWorkflowDefinition>) =>
      api.post<ApiWorkflowDefinition>('/admin/workflows', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<ApiWorkflowDefinition>) =>
      api.patch<ApiWorkflowDefinition>(`/admin/workflows/${id}`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow', vars.id] });
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/workflows/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useRunWorkflow() {
  return useMutation({
    mutationFn: ({ id, complaintId }: { id: string; complaintId: string }) =>
      api.post<ApiWorkflowRun>(`/admin/workflows/${id}/run`, { complaintId }).then(r => r.data),
  });
}

export function useDryRunWorkflow() {
  return useMutation({
    mutationFn: ({ id, complaintId }: { id: string; complaintId: string }) =>
      api.post<ApiWorkflowStepLog[]>(`/admin/workflows/${id}/dry-run`, { complaintId }).then(r => r.data),
  });
}

export function useWorkflowRuns(workflowId: string) {
  return useQuery({
    queryKey: ['workflow-runs', workflowId],
    queryFn: () => api.get<ApiWorkflowRun[]>(`/admin/workflows/${workflowId}/runs`).then(r => r.data),
    enabled: !!workflowId,
  });
}

export function useComplaintWorkflowRuns(complaintId: string) {
  return useQuery({
    queryKey: ['workflow-runs', 'complaint', complaintId],
    queryFn: () => api.get<ApiWorkflowRun[]>(`/admin/workflows/complaints/${complaintId}/runs`).then(r => r.data),
    enabled: !!complaintId,
  });
}
