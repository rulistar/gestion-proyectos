import {
  matchesTemplate,
  memberListSchema,
  workspaceDetailSchema,
  workspaceListSchema,
  workspaceSummarySchema,
  type CreateWorkspaceRequest,
  type MemberPermissions,
  type MembershipRole,
  type UpdateMemberPermissions,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { meQueryKey } from './auth';

export const ROLE_LABELS: Record<MembershipRole, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Miembro',
  VIEWER: 'Lector',
};

/** "Miembro" o "Miembro (ajustado)" si la matriz ya no es la de la plantilla (ADR-0006 §2) */
export function roleLabel(role: MembershipRole, permissions: MemberPermissions): string {
  return matchesTemplate(role, permissions) ? ROLE_LABELS[role] : `${ROLE_LABELS[role]} (ajustado)`;
}

export const workspacesQueryOptions = queryOptions({
  queryKey: ['workspaces'],
  queryFn: () => apiFetch('/workspaces', { schema: workspaceListSchema }),
});

/** Un workspace con mi rol y mi matriz (para saber qué botones mostrar; la API decide igualmente) */
export const workspaceQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId],
    queryFn: () => apiFetch(`/workspaces/${workspaceId}`, { schema: workspaceDetailSchema }),
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

/** Tras cambiar miembros: su lista, mi usuario (por si me quité a mí) y las tareas (responsables) */
function invalidateMembers(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
    queryClient.invalidateQueries({ queryKey: meQueryKey }),
  ]);
}

/** Cambiar el rol de un miembro (HU-25, solo el Admin) */
export function useChangeMemberRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: MembershipRole }) =>
      apiFetch(`/workspaces/${workspaceId}/members/${userId}`, {
        method: 'PATCH',
        body: { role },
      }),
    onSuccess: () => invalidateMembers(queryClient),
  });
}

/** Quitar a un miembro del espacio (HU-25, solo el Admin): pierde el acceso al instante */
export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateMembers(queryClient),
  });
}

/** Plantilla + matriz + lista "Estos…" de un miembro (HU-17b, solo el Admin) */
export function useChangeMemberPermissions(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...data }: UpdateMemberPermissions & { userId: string }) =>
      apiFetch(`/workspaces/${workspaceId}/members/${userId}/permissions`, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => invalidateMembers(queryClient),
  });
}
