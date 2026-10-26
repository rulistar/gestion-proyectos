import {
  statusNeedsReason,
  type MyTask,
  type Task,
  type TaskInput,
  type TaskStatus,
} from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';
import { fromIsoDate, toIsoDate } from '../../db/dates.js';
import { resolveTaskType } from '../task-types/task-types.service.js';

/** El tipo pedido no existe, está archivado o no lo admite el tipo del proyecto (→ 400) */
export class InvalidTaskTypeError extends Error {}

const taskSelect = {
  id: true,
  projectId: true,
  title: true,
  type: { select: { id: true, name: true, expedited: true } },
  status: true,
  estimatedMinutes: true,
  assigneeId: true,
  startDate: true,
  endDate: true,
  completedAt: true,
  startedAt: true,
  statusReason: true,
  workspaceId: true,
  // Nombre del responsable y sus membresías vigentes: para saber si sigue en el espacio (HU-25)
  assignee: {
    select: {
      name: true,
      status: true,
      memberships: { where: notDeleted, select: { workspaceId: true } },
    },
  },
} as const;

type TaskRow = Omit<
  Task,
  'startDate' | 'endDate' | 'completedAt' | 'startedAt' | 'assigneeName' | 'assigneeIsMember'
> & {
  startDate: Date | null;
  endDate: Date | null;
  completedAt: Date | null;
  startedAt: Date | null;
  workspaceId: string;
  assignee: { name: string; status: string; memberships: { workspaceId: string }[] } | null;
};

function toTask({ workspaceId, assignee, ...row }: TaskRow): Task {
  return {
    ...row,
    assigneeName: assignee?.name ?? null,
    // Sin responsable no hay nada que marcar; con responsable, debe ser miembro activo del espacio
    assigneeIsMember:
      !assignee ||
      (assignee.status === 'ACTIVE' &&
        assignee.memberships.some((m) => m.workspaceId === workspaceId)),
    startDate: toIsoDate(row.startDate),
    endDate: toIsoDate(row.endDate),
    completedAt: row.completedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
  };
}

/** Responsable actual de una tarea del proyecto (undefined si la tarea no existe) */
export async function currentAssignee(
  db: Db,
  where: { workspaceId: string; projectId: string; taskId: string },
): Promise<string | null | undefined> {
  const task = await db.task.findFirst({
    where: { id: where.taskId, ...taskScope(where.workspaceId, where.projectId) },
    select: { assigneeId: true },
  });
  return task === null ? undefined : task.assigneeId;
}

/**
 * Regla del prototipo (ADR-0002 §1.1): al pasar a Hecha se guarda cuándo; si ya estaba Hecha se
 * conserva la fecha original; al salir de Hecha se vacía.
 */
export function completedAtFor(
  status: TaskStatus,
  previous: { status: TaskStatus; completedAt: Date | null } | null,
  now = new Date(),
): Date | null {
  if (status !== 'DONE') return null;
  return previous?.status === 'DONE' ? previous.completedAt : now;
}

/**
 * Inicio real (ADR-0004 §2.1): la primera vez que la tarea pasa a En curso, o a Hecha si se salta
 * En curso. Una vez registrado no se borra, aunque la tarea se reabra.
 */
export function startedAtFor(
  status: TaskStatus,
  previous: Date | null,
  now = new Date(),
): Date | null {
  return previous ?? (status === 'IN_PROGRESS' || status === 'DONE' ? now : null);
}

/** El motivo solo se guarda en Pausada y Cancelada (HU-24); al salir de esos estados se limpia */
function reasonFor(status: TaskStatus, reason: string | null | undefined): string | null {
  return statusNeedsReason(status) ? (reason ?? null) : null;
}

/** Tareas del proyecto en ese workspace; si el proyecto está en la papelera, tampoco se ven */
function taskScope(workspaceId: string, projectId: string) {
  return { workspaceId, projectId, ...notDeleted, project: notDeleted };
}

export async function listTasks(db: Db, workspaceId: string, projectId: string): Promise<Task[]> {
  const rows = await db.task.findMany({
    where: taskScope(workspaceId, projectId),
    select: taskSelect,
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toTask);
}

/**
 * Mis tareas en el workspace (HU-28b), de proyectos que no están en la papelera: las abiertas
 * y las Hechas desde `doneSince` (para "hechas esta semana"). Las canceladas no se piden.
 */
export async function listMyTasks(
  db: Db,
  workspaceId: string,
  userId: string,
  doneSince: Date,
): Promise<MyTask[]> {
  const rows = await db.task.findMany({
    where: {
      workspaceId,
      assigneeId: userId,
      ...notDeleted,
      project: notDeleted,
      OR: [
        { status: { in: ['PENDING', 'IN_PROGRESS', 'PAUSED'] } },
        { status: 'DONE', completedAt: { gte: doneSince } },
      ],
    },
    select: { ...taskSelect, project: { select: { name: true } } },
    orderBy: [{ endDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  });
  return rows.map(({ project, ...row }) => ({ ...toTask(row), projectName: project.name }));
}

/** El proyecto ya se comprobó (existe en el workspace y no está borrado) */
export async function createTask(
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
  { typeId: requestedType, ...input }: TaskInput,
): Promise<Task> {
  const typeId = await resolveTaskType(db, workspaceId, projectId, requestedType);
  if (!typeId) throw new InvalidTaskTypeError();
  const row = await db.task.create({
    data: {
      workspaceId,
      projectId,
      ...input,
      typeId,
      startDate: fromIsoDate(input.startDate),
      endDate: fromIsoDate(input.endDate),
      completedAt: completedAtFor(input.status, null),
      startedAt: startedAtFor(input.status, null),
      statusReason: reasonFor(input.status, input.statusReason),
      ...auditCreate(actorId),
    },
    select: taskSelect,
  });
  return toTask(row);
}

/**
 * Aplica `changes` a una tarea del proyecto (todos los datos o solo el estado).
 * null si la tarea no existe en ese proyecto y workspace (→ 404).
 */
async function applyUpdate(
  db: Db,
  actorId: string,
  where: { workspaceId: string; projectId: string; taskId: string },
  { typeId: requestedType, ...changes }: Partial<TaskInput> & { status: TaskStatus },
): Promise<Task | null> {
  const previous = await db.task.findFirst({
    where: { id: where.taskId, ...taskScope(where.workspaceId, where.projectId) },
    select: { status: true, completedAt: true, startedAt: true, typeId: true },
  });
  if (!previous) return null;
  // Solo la edición completa trae typeId; mover de columna no cambia el tipo
  const typeId =
    requestedType === undefined
      ? previous.typeId
      : await resolveTaskType(
          db,
          where.workspaceId,
          where.projectId,
          requestedType,
          previous.typeId,
        );
  if (!typeId) throw new InvalidTaskTypeError();

  const row = await db.task.update({
    where: { id: where.taskId },
    data: {
      ...changes,
      typeId,
      startedAt: startedAtFor(changes.status, previous.startedAt),
      ...(changes.startDate !== undefined && { startDate: fromIsoDate(changes.startDate) }),
      ...(changes.endDate !== undefined && { endDate: fromIsoDate(changes.endDate) }),
      completedAt: completedAtFor(changes.status, previous),
      statusReason: reasonFor(changes.status, changes.statusReason),
      ...auditUpdate(actorId),
    },
    select: taskSelect,
  });
  return toTask(row);
}

export function updateTask(
  db: Db,
  actorId: string,
  where: { workspaceId: string; projectId: string; taskId: string },
  input: TaskInput,
) {
  return applyUpdate(db, actorId, where, input);
}

export function updateTaskStatus(
  db: Db,
  actorId: string,
  where: { workspaceId: string; projectId: string; taskId: string },
  status: TaskStatus,
  statusReason: string | null,
) {
  return applyUpdate(db, actorId, where, { status, statusReason });
}

/** Manda la tarea a la papelera (HU-15); false si no existe en ese proyecto (→ 404) */
export async function softDeleteTask(
  db: Db,
  actorId: string,
  where: { workspaceId: string; projectId: string; taskId: string },
): Promise<boolean> {
  const { count } = await db.task.updateMany({
    where: { id: where.taskId, ...taskScope(where.workspaceId, where.projectId) },
    data: auditSoftDelete(actorId),
  });
  return count > 0;
}
