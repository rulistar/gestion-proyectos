import {
  projectListSchema,
  projectSchema,
  type ProjectInput,
  type ProjectPriority,
  type ProjectStatus,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Etiquetas y colores del prototipo "Gestor de cursos" (ADR-0002 §1.1) */
export const PROJECT_STATUSES: Record<ProjectStatus, { label: string; color: string }> = {
  NOT_STARTED: { label: 'No iniciado', color: '#8FB8D9' },
  IN_PROGRESS: { label: 'En curso', color: '#E8C468' },
  PAUSED: { label: 'Pausado', color: '#B79FD1' },
  CANCELLED: { label: 'Cancelado', color: '#D98884' },
  DONE: { label: 'Terminado', color: '#8FC9A0' },
};

export const PROJECT_PRIORITIES: Record<ProjectPriority, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

const projectsKey = (workspaceId: string) => ['workspaces', workspaceId, 'projects'];

export const projectsQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: projectsKey(workspaceId),
    queryFn: () => apiFetch(`/workspaces/${workspaceId}/projects`, { schema: projectListSchema }),
  });

export const projectQueryOptions = (workspaceId: string, projectId: string) =>
  queryOptions({
    queryKey: [...projectsKey(workspaceId), projectId],
    queryFn: () =>
      apiFetch(`/workspaces/${workspaceId}/projects/${projectId}`, { schema: projectSchema }),
  });

export function useCreateProject(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectInput) =>
      apiFetch(`/workspaces/${workspaceId}/projects`, {
        method: 'POST',
        body: data,
        schema: projectSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey(workspaceId) }),
  });
}

export function useUpdateProject(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectInput) =>
      apiFetch(`/workspaces/${workspaceId}/projects/${projectId}`, {
        method: 'PUT',
        body: data,
        schema: projectSchema,
      }),
    // Invalida la lista y el detalle (la clave del detalle empieza igual que la de la lista)
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey(workspaceId) }),
  });
}

/** Dar de baja: el proyecto va a la papelera (HU-15) */
export function useDeleteProject(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/workspaces/${workspaceId}/projects/${projectId}`, { method: 'DELETE' }),
    // Solo la lista y la papelera: refrescar el detalle daría 404 mientras la página sigue abierta
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: projectsKey(workspaceId), exact: true }),
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'trash'] }),
      ]),
  });
}
