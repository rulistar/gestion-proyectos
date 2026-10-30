import {
  phaseListSchema,
  phaseSchema,
  type CreatePhaseInput,
  type MovePhaseInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

const phasesPath = (workspaceId: string, projectId: string) =>
  `/workspaces/${workspaceId}/projects/${projectId}/phases`;

/** Fases de un proyecto (HU-07); la clave cuelga de la del proyecto */
export const phasesQueryOptions = (workspaceId: string, projectId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'projects', projectId, 'phases'],
    queryFn: () => apiFetch(phasesPath(workspaceId, projectId), { schema: phaseListSchema }),
  });

/** Dar de baja una fase cambia tareas, avance y papelera: se refresca todo el espacio */
function useWorkspaceInvalidation(workspaceId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] });
}

export function useCreatePhase(workspaceId: string, projectId: string) {
  const invalidate = useWorkspaceInvalidation(workspaceId);
  return useMutation({
    mutationFn: (data: CreatePhaseInput) =>
      apiFetch(phasesPath(workspaceId, projectId), {
        method: 'POST',
        body: data,
        schema: phaseSchema,
      }),
    onSuccess: invalidate,
  });
}

export function useRenamePhase(workspaceId: string, projectId: string) {
  const invalidate = useWorkspaceInvalidation(workspaceId);
  return useMutation({
    mutationFn: ({ phaseId, name }: { phaseId: string; name: string }) =>
      apiFetch(`${phasesPath(workspaceId, projectId)}/${phaseId}`, {
        method: 'PATCH',
        body: { name },
      }),
    onSuccess: invalidate,
  });
}

export function useMovePhase(workspaceId: string, projectId: string) {
  const invalidate = useWorkspaceInvalidation(workspaceId);
  return useMutation({
    mutationFn: ({ phaseId, direction }: MovePhaseInput & { phaseId: string }) =>
      apiFetch(`${phasesPath(workspaceId, projectId)}/${phaseId}/move`, {
        method: 'POST',
        body: { direction },
      }),
    onSuccess: invalidate,
  });
}

export function useDeletePhase(workspaceId: string, projectId: string) {
  const invalidate = useWorkspaceInvalidation(workspaceId);
  return useMutation({
    mutationFn: (phaseId: string) =>
      apiFetch(`${phasesPath(workspaceId, projectId)}/${phaseId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
