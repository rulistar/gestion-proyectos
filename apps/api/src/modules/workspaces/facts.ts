import {
  canViewTask,
  type ContainerFacts,
  type ProjectBehavior,
  type ProjectScope,
  type TaskFacts,
} from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { notDeleted } from '../../db/audit.js';
import type { WorkspaceAccess } from './access.js';
import { myTasksWhere, projectVisibleWhere } from './visibility.js';

/**
 * Datos mínimos para que las reglas de shared (ADR-0006) decidan si alguien puede modificar o dar
 * de baja un contenedor o una tarea. Solo devuelven lo que la persona puede **ver**: lo demás es
 * null y la ruta responde 404, sin revelar que existe.
 */

const containerSelect = {
  id: true,
  createdById: true,
  scope: true,
  type: { select: { behavior: true } },
};

function toContainer(row: {
  id: string;
  createdById: string | null;
  scope: ProjectScope;
  type: { behavior: ProjectBehavior };
}): ContainerFacts {
  return {
    id: row.id,
    createdById: row.createdById,
    behavior: row.type.behavior,
    scope: row.scope,
  };
}

/** Un contenedor del espacio que la persona ve (también en solo lectura por tener una tarea) */
export async function visibleContainer(
  db: Db,
  access: WorkspaceAccess,
  projectId: string,
): Promise<ContainerFacts | null> {
  const row = await db.project.findFirst({
    where: {
      id: projectId,
      workspaceId: access.workspaceId,
      ...notDeleted,
      AND: [projectVisibleWhere(access)],
    },
    select: containerSelect,
  });
  return row && toContainer(row);
}

/** Una tarea del contenedor que la persona ve */
export async function visibleTask(
  db: Db,
  access: WorkspaceAccess,
  projectId: string,
  taskId: string,
): Promise<TaskFacts | null> {
  const row = await db.task.findFirst({
    where: {
      id: taskId,
      projectId,
      workspaceId: access.workspaceId,
      ...notDeleted,
      project: notDeleted,
    },
    select: { createdById: true, responsiblePersonId: true, project: { select: containerSelect } },
  });
  if (!row) return null;
  const inMyContainer =
    (await db.task.count({ where: { projectId, ...notDeleted, ...myTasksWhere(access) } })) > 0;
  const facts = { ...row, project: toContainer(row.project), inMyContainer };
  return canViewTask(access, facts) ? facts : null;
}

/** Un contenedor en la papelera, con lo necesario para decidir si puede restaurarlo */
export async function trashedContainer(
  db: Db,
  workspaceId: string,
  projectId: string,
): Promise<ContainerFacts | null> {
  const row = await db.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: { not: null } },
    select: containerSelect,
  });
  return row && toContainer(row);
}

/** Una tarea en la papelera (de un contenedor activo) */
export async function trashedTask(
  db: Db,
  workspaceId: string,
  taskId: string,
): Promise<TaskFacts | null> {
  const row = await db.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: { not: null }, project: notDeleted },
    select: { createdById: true, responsiblePersonId: true, project: { select: containerSelect } },
  });
  return row && { ...row, project: toContainer(row.project) };
}
