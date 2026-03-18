import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiUser } from '@/types/api';

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  roles: ('complainant' | 'committee_member' | 'manager' | 'admin')[];
  department?: string;
}

export function useUsers() {
  return useQuery<ApiUser[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<ApiUser[]>('/users');
      return data;
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) =>
      api.post<ApiUser>('/users', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
