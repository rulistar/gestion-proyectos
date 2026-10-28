import {
  taskOriginListSchema,
  type CreateTaskOriginInput,
  type UpdateTaskOriginInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

const originsPath = (workspaceId: string) => `/workspaces/${workspaceId}/task-origins`;

/** Catálogo de orígenes de tarea del espacio (HU-47), archivados incluidos */
export const taskOriginsQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'task-origins'],
    queryFn: () => apiFetch(originsPath(workspaceId), { schema: taskOriginListSchema }),
  });

/** El nombre del origen aparece en las tareas: se refresca el espacio */
export function useCreateTaskOrigin(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskOriginInput) =>
      apiFetch(originsPath(workspaceId), {
        method: 'POST',
        body: data,
        schema: taskOriginListSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}

export function useUpdateTaskOrigin(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ originId, ...data }: UpdateTaskOriginInput & { originId: string }) =>
      apiFetch(`${originsPath(workspaceId)}/${originId}`, {
        method: 'PATCH',
        body: data,
        schema: taskOriginListSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}
