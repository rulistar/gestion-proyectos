import {
  currentUserSchema,
  type ChangeMyEmailInput,
  type ChangeMyPasswordInput,
  type CurrentUser,
  type LoginRequest,
  type UpdateMyNameInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ApiError, apiFetch } from './api';

export const meQueryKey = ['auth', 'me'] as const;

/** Usuario de la sesión actual, o null si no hay sesión. Lo usan las rutas protegidas */
export const meQueryOptions = queryOptions({
  queryKey: meQueryKey,
  queryFn: async (): Promise<CurrentUser | null> => {
    try {
      return await apiFetch('/auth/me', { schema: currentUserSchema });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  staleTime: 5 * 60_000,
});

/** Usuario actual dentro de una ruta protegida (allí siempre existe: la ruta ya lo comprobó) */
export function useCurrentUser(): CurrentUser {
  const { data } = useSuspenseQuery(meQueryOptions);
  if (!data) throw new Error('useCurrentUser solo se usa en rutas protegidas');
  return data;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginRequest) =>
      apiFetch('/auth/login', { method: 'POST', body: credentials, schema: currentUserSchema }),
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      // Se descarta todo lo cacheado: nada del usuario anterior queda en memoria
      queryClient.clear();
      queryClient.setQueryData(meQueryKey, null);
    },
  });
}

/** Mi perfil (HU-29): el nombre se ve en el menú y en las personas de cada espacio */
export function useUpdateMyName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateMyNameInput) =>
      apiFetch('/auth/me/name', { method: 'PATCH', body: data, schema: currentUserSchema }),
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey, user);
      // Mi persona en cada espacio pudo cambiar de nombre
      return queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useChangeMyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ChangeMyEmailInput) =>
      apiFetch('/auth/me/email', { method: 'PUT', body: data, schema: currentUserSchema }),
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useChangeMyPassword() {
  return useMutation({
    mutationFn: (data: ChangeMyPasswordInput) =>
      apiFetch('/auth/me/password', { method: 'PUT', body: data }),
  });
}
