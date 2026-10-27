import {
  taskTypeListSchema,
  type CreateTaskTypeInput,
  type ProjectType,
  type TaskType,
  type TaskTypeRef,
  type UpdateTaskTypeInput,
} from '@gestion/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Color de la etiqueta de los tipos iniciales (maqueta de HU-28); los demás, en gris */
const TYPE_COLORS: Record<string, string> = {
  Incidencia: 'bg-[#FDECEC] text-[#A1281F]',
  Entregable: 'bg-[#EEF4FB] text-[#1D4E89]',
  Reunión: 'bg-[#F4EBFF] text-[#5B2BA6]',
  Revisión: 'bg-accent text-accent-foreground',
};

/** Clases de la etiqueta de un tipo: dorado si es de atención inmediata */
export function taskTypeClass(type: TaskTypeRef) {
  if (type.expedited) return 'bg-warning/40 text-warning-foreground';
  return TYPE_COLORS[type.name] ?? 'bg-muted text-foreground';
}

export const taskTypesQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId, 'task-types'],
    queryFn: () =>
      apiFetch(`/workspaces/${workspaceId}/task-types`, { schema: taskTypeListSchema }),
  });

/**
 * Tipos de tarea que se pueden elegir en un contenedor: los suyos propios (HU-37) o, sin ellos,
 * los que admite su tipo (HU-22; todos, si no limita ninguno). Al editar, también el que la tarea
 * ya tiene.
 */
export function allowedTaskTypes(
  taskTypes: TaskType[],
  projectType: ProjectType | undefined,
  projectOwn: string[],
  currentId?: string,
) {
  const allowed = new Set(projectOwn.length > 0 ? projectOwn : projectType?.allowedTaskTypeIds);
  return taskTypes.filter(
    (type) =>
      type.id === currentId || (!type.archived && (allowed.size === 0 || allowed.has(type.id))),
  );
}

export function useCreateTaskType(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskTypeInput) =>
      apiFetch(`/workspaces/${workspaceId}/task-types`, {
        method: 'POST',
        body: data,
        schema: taskTypeListSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}

export function useUpdateTaskType(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ typeId, ...data }: UpdateTaskTypeInput & { typeId: string }) =>
      apiFetch(`/workspaces/${workspaceId}/task-types/${typeId}`, {
        method: 'PATCH',
        body: data,
        schema: taskTypeListSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId] }),
  });
}
