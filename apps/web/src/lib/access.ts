import type {
  ContainerFacts,
  MemberAccess,
  ProjectBehavior,
  ProjectScope,
  Task,
  TaskFacts,
} from '@gestion/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { workspaceQueryOptions } from './workspaces';

/**
 * Mi acceso en el espacio (ADR-0006): rol y matriz, para decidir con las reglas de shared qué
 * botones mostrar. Ocultar no es seguridad: la API vuelve a decidir en cada petición.
 */
export function useAccess(workspaceId: string): MemberAccess {
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId));
  return { role: workspace.role, ...workspace.access };
}

/** Lo que las reglas necesitan de un contenedor */
export function containerFacts(project: {
  id: string;
  createdById: string | null;
  scope: ProjectScope;
  type: { behavior: ProjectBehavior };
}): ContainerFacts {
  return {
    id: project.id,
    createdById: project.createdById,
    behavior: project.type.behavior,
    scope: project.scope,
  };
}

/**
 * Lo que las reglas necesitan de una tarea (con su contenedor). `inMyContainer`: el contenedor
 * tiene una tarea mía (HU-53)
 */
export function taskFacts(task: Task, project: ContainerFacts, inMyContainer = false): TaskFacts {
  return {
    createdById: task.createdById,
    responsiblePersonId: task.responsible?.id ?? null,
    project,
    inMyContainer,
  };
}
