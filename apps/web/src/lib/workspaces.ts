import {
  memberListSchema,
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

/** Un workspace con mi rol en él (para saber qué botones mostrar; la API decide igualmente) */
export const workspaceQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId],
    queryFn: () => apiFetch(`/workspaces/${workspaceId}`, { schema: workspaceSummarySchema }),
  });

/** Miembros activos del workspace (p. ej. para elegir el responsable de una tarea) */
export const membersQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'members'],
    queryFn: () => apiFetch(`/workspaces/${workspaceId}/members`, { schema: memberListSchema }),
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

/** Renombrar el espacio (solo el Admin): cambia la etiqueta; el ID y todo lo demás siguen igual */
export function useRenameWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkspaceRequest) =>
      apiFetch(`/workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: data,
        schema: workspaceSummarySchema,
      }),
    // El nombre aparece en el combo (viene de /auth/me) y en las páginas del espacio
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
        queryClient.invalidateQueries({ queryKey: meQueryKey }),
      ]),
  });
}
