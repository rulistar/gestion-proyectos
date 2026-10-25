import {
  createInvitationResponseSchema,
  invitationListSchema,
  type CreateInvitationRequest,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

const invitationsKey = (workspaceId: string) => ['workspaces', workspaceId, 'invitations'];

export const invitationsQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: invitationsKey(workspaceId),
    queryFn: () =>
      apiFetch(`/workspaces/${workspaceId}/invitations`, { schema: invitationListSchema }),
  });

export function useCreateInvitation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvitationRequest) =>
      apiFetch(`/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: data,
        schema: createInvitationResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsKey(workspaceId) }),
  });
}

export function useRevokeInvitation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      apiFetch(`/workspaces/${workspaceId}/invitations/${invitationId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsKey(workspaceId) }),
  });
}

/**
 * Enlace que el Admin envía a la persona invitada. El token va después de "#": esa parte de la
 * URL nunca se envía al servidor, así que no queda en registros de acceso ni en la cabecera Referer.
 */
export function invitationLink(token: string): string {
  return `${window.location.origin}/invitacion#${token}`;
}
