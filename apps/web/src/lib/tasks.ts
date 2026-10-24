import {
  taskListSchema,
  taskSchema,
  type TaskInput,
  type TaskStatus,
  type TaskType,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export const TASK_STATUSES: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  DONE: 'Hecha',
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

/** La clave cuelga de la del proyecto: al cambiar una tarea se refresca también su proyecto */
const tasksKey = (workspaceId: string, projectId: string) => [
  'workspaces',
  workspaceId,
  'projects',
  projectId,
  'tasks',
];

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(workspaceId, projectId) }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(workspaceId, projectId) }),
  });
}

export function useMoveTask(workspaceId: string, projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: TaskStatus) =>
      apiFetch(`${tasksPath(workspaceId, projectId)}/${taskId}/status`, {
        method: 'PATCH',
        body: { status },
        schema: taskSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey(workspaceId, projectId) }),
  });
}
