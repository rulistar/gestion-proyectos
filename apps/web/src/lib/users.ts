import {
  systemUserListSchema,
  type ChangeUserEmailInput,
  type SetUserStatusInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

const usersKey = ['users'];

/** Todas las cuentas (HU-30); solo las pide el Admin del sistema */
export const usersQueryOptions = queryOptions({
  queryKey: usersKey,
  queryFn: () => apiFetch('/users', { schema: systemUserListSchema }),
});

export function useChangeUserEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...data }: ChangeUserEmailInput & { userId: string }) =>
      apiFetch(`/users/${userId}/email`, {
        method: 'PUT',
        body: data,
        schema: systemUserListSchema,
      }),
    onSuccess: (users) => queryClient.setQueryData(usersKey, users),
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...data }: SetUserStatusInput & { userId: string }) =>
      apiFetch(`/users/${userId}/status`, {
        method: 'PATCH',
        body: data,
        schema: systemUserListSchema,
      }),
    onSuccess: (users) => queryClient.setQueryData(usersKey, users),
  });
}
