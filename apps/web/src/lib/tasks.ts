import {
  taskListSchema,
  taskSchema,
  type TaskInput,
  type TaskStatus,
  type TaskStatusUpdate,
  type TaskType,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** En este orden se muestran las columnas del tablero */
export const TASK_STATUSES: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  PAUSED: 'Pausada',
  DONE: 'Hecha',
  CANCELLED: 'Cancelada',
};

export const TASK_TYPES: Record<TaskType, string> = {
  TASK: 'Tarea',
  MEETING: 'Reunión',
  DELIVERABLE: 'Entregable',
  REVIEW: 'Revisión',
  RESEARCH: 'Investigación',
  EXAM: 'Examen',
};

const tasksPath = (workspaceId: string, projectId: string) =>
  `/workspaces/${workspaceId}/projects/${projectId}/tasks`;

/** La clave cuelga de la del proyecto */
const tasksKey = (workspaceId: string, projectId: string) => [
  'workspaces',
  workspaceId,
  'projects',
  projectId,
  'tasks',
];

/**
 * Una tarea cambia el avance de su proyecto (HU-06) y "Mi trabajo" (HU-28b): se refresca todo lo
 * del workspace (solo se vuelve a pedir lo que está en pantalla)
 */
function invalidateWorkspace(queryClient: QueryClient, workspaceId: string) {
  return queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] });
}

export const tasksQueryOptions = (workspaceId: string, projectId: string) =>
  queryOptions({
    queryKey: tasksKey(workspaceId, projectId),
    queryFn: () => apiFetch(tasksPath(workspaceId, projectId), { schema: taskListSchema }),
  });

export function useCreateTask(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskInput) =>
      apiFetch(tasksPath(workspaceId, projectId), {
        method: 'POST',
        body: data,
        schema: taskSchema,
      }),
    onSuccess: () => invalidateWorkspace(queryClient, workspaceId),
  });
}

export function useUpdateTask(workspaceId: string, projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskInput) =>
      apiFetch(`${tasksPath(workspaceId, projectId)}/${taskId}`, {
        method: 'PUT',
        body: data,
        schema: taskSchema,
      }),
    onSuccess: () => invalidateWorkspace(queryClient, workspaceId),
  });
}

export function useMoveTask(workspaceId: string, projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // El motivo solo se envía al pausar o cancelar (HU-24)
    mutationFn: (change: TaskStatusUpdate) =>
      apiFetch(`${tasksPath(workspaceId, projectId)}/${taskId}/status`, {
        method: 'PATCH',
        body: change,
        schema: taskSchema,
      }),
    onSuccess: () => invalidateWorkspace(queryClient, workspaceId),
  });
}

/** Dar de baja: la tarea va a la papelera (HU-15) */
export function useDeleteTask(workspaceId: string, projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`${tasksPath(workspaceId, projectId)}/${taskId}`, { method: 'DELETE' }),
    // También cambia la papelera
    onSuccess: () => invalidateWorkspace(queryClient, workspaceId),
  });
}
