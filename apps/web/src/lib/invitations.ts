import {
  acceptInvitationResponseSchema,
  createInvitationResponseSchema,
  invitationListSchema,
  invitationPreviewSchema,
  type AcceptInvitationResponse,
  type CreateInvitationRequest,
  type LoginRequest,
  type RegisterFromInvitationRequest,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { meQueryKey } from './auth';

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

// --- Aceptar una invitación (HU-01): el token va en el cuerpo, nunca en la URL de la API ---

/** A qué workspace y con qué rol me invitan; error 404 si el enlace no sirve */
export const invitationPreviewQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ['invitation-preview', token],
    queryFn: () =>
      apiFetch('/invitations/preview', {
        method: 'POST',
        body: { token },
        schema: invitationPreviewSchema,
      }),
    // No se vuelve a pedir al regresar a la pestaña: cada petición cuenta para el límite de intentos
    staleTime: Infinity,
  });

/** Al aceptar ya hay sesión: se guarda el usuario y se refrescan sus workspaces */
function onAccepted(queryClient: QueryClient, { user }: AcceptInvitationResponse) {
  queryClient.setQueryData(meQueryKey, user);
  void queryClient.invalidateQueries({ queryKey: ['workspaces'] });
}

export function useRegisterFromInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterFromInvitationRequest) =>
      apiFetch('/invitations/register', {
        method: 'POST',
        body: data,
        schema: acceptInvitationResponseSchema,
      }),
    onSuccess: (response) => onAccepted(queryClient, response),
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch('/invitations/accept', {
        method: 'POST',
        body: { token },
        schema: acceptInvitationResponseSchema,
      }),
    onSuccess: (response) => onAccepted(queryClient, response),
  });
}

/**
 * Ya tiene cuenta pero no sesión: inicia sesión y acepta en un solo paso. No usa useLogin a
 * propósito: guardar el usuario a la mitad hace que la página cambie de vista (a «Aceptar
 * invitación»), la vista que llamó se desmonta y su callback de éxito ya no corre. El usuario
 * se guarda solo al final, ya aceptada la invitación.
 */
export function useLoginAndAccept(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      await apiFetch('/auth/login', { method: 'POST', body: credentials });
      return apiFetch('/invitations/accept', {
        method: 'POST',
        body: { token },
        schema: acceptInvitationResponseSchema,
      });
    },
    onSuccess: (response) => onAccepted(queryClient, response),
  });
}
