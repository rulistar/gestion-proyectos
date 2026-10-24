import {
  workspaceListSchema,
  workspaceSummarySchema,
  type CreateWorkspaceRequest,
  type MembershipRole,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { meQueryKey } from './auth';

export const ROLE_LABELS: Record<MembershipRole, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Miembro',
  VIEWER: 'Lector',
};

export const workspacesQueryOptions = queryOptions({
  queryKey: ['workspaces'],
  queryFn: () => apiFetch('/workspaces', { schema: workspaceListSchema }),
});

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkspaceRequest) =>
      apiFetch('/workspaces', { method: 'POST', body: data, schema: workspaceSummarySchema }),
    // Los datos cacheados quedaron viejos: se vuelven a pedir a la API
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: workspacesQueryOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: meQueryKey }),
      ]),
  });
}
