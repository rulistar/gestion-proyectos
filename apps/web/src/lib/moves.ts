import type { MoveProjectInput, MoveTaskInput } from '@gestion/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Mover cambia dos espacios a la vez: se refresca todo lo cargado de los espacios (HU-32) */
function useMove<T>(request: (input: T) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  });
}

/**
 * Sin refrescar aquí: el proyecto ya no existe en el origen y su página daría 404. Quien lo usa
 * navega primero al destino y después refresca los espacios.
 */
export function useMoveProject(workspaceId: string, projectId: string) {
  return useMutation({
    mutationFn: (input: MoveProjectInput) =>
      apiFetch(`/workspaces/${workspaceId}/projects/${projectId}/move`, {
        method: 'POST',
        body: input,
      }),
  });
}

export function useMoveTaskToProject(workspaceId: string, projectId: string, taskId: string) {
  return useMove((input: MoveTaskInput) =>
    apiFetch(`/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/move`, {
      method: 'POST',
      body: input,
    }),
  );
}
