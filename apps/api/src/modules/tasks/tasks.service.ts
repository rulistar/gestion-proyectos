import {
  statusNeedsReason,
  type MyTask,
  type PersonRef,
  type Task,
  type TaskInput,
  type TaskRole,
  type TaskStatus,
} from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';
import { fromIsoDate, toIsoDate } from '../../db/dates.js';
import { resolveTaskType } from '../task-types/task-types.service.js';

/** El tipo pedido no existe, está archivado o no lo admite el tipo del proyecto (→ 400) */
export class InvalidTaskTypeError extends Error {}

/** Lo que se lee de cada persona responsable: si su cuenta sigue teniendo acceso al espacio */
const personSelect = {
  select: {
    id: true,
    name: true,
    userId: true,
    archivedAt: true,
    user: {
      select: { status: true, memberships: { where: notDeleted, select: { workspaceId: true } } },
    },
  },
} as const;

type PersonRow = {
  id: string;
  name: string;
  userId: string | null;
  archivedAt: Date | null;
  user: { status: string; memberships: { workspaceId: string }[] } | null;
} | null;

function toPersonRef(person: PersonRow, workspaceId: string): PersonRef | null {
  if (!person) return null;
  const { archivedAt, user, ...rest } = person;
  return {
    ...rest,
    // Sin cuenta no hay acceso que perder; con cuenta, debe seguir siendo miembro (ADR-0005 §1)
    hasAccess:
      user !== null &&
      user.status === 'ACTIVE' &&
      user.memberships.some((m) => m.workspaceId === workspaceId),
    archived: archivedAt !== null,
  };
}

const taskSelect = {
  id: true,
  projectId: true,
  title: true,
  type: { select: { id: true, name: true, expedited: true } },
  status: true,
  estimatedMinutes: true,
  startDate: true,
  endDate: true,
  completedAt: true,
  startedAt: true,
  statusReason: true,
  workspaceId: true,
  // Responsabilidades (HU-35): Actividad, Gestión y Seguimiento
  activityPerson: personSelect,
  managementPerson: personSelect,
  followUpPerson: personSelect,
} as const;

type TaskRow = Omit<
  Task,
  'startDate' | 'endDate' | 'completedAt' | 'startedAt' | 'activity' | 'management' | 'followUp'
> & {
  startDate: Date | null;
  endDate: Date | null;
  completedAt: Date | null;
  startedAt: Date | null;
  workspaceId: string;
  activityPerson: PersonRow;
  managementPerson: PersonRow;
  followUpPerson: PersonRow;
};

function toTask({
  workspaceId,
  activityPerson,
  managementPerson,
  followUpPerson,
  ...row
}: TaskRow): Task {
  return {
    ...row,
    activity: toPersonRef(activityPerson, workspaceId),
    management: toPersonRef(managementPerson, workspaceId),
    followUp: toPersonRef(followUpPerson, workspaceId),
    startDate: toIsoDate(row.startDate),
    endDate: toIsoDate(row.endDate),
    completedAt: row.completedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
  };
}

/** Personas responsables actuales de una tarea del proyecto (undefined si la tarea no existe) */
export async function currentPeople(
  db: Db,
  where: { workspaceId: string; projectId: string; taskId: string },
) {
  const task = await db.task.findFirst({
    where: { id: where.taskId, ...taskScope(where.workspaceId, where.projectId) },
    select: { activityPersonId: true, managementPersonId: true, followUpPersonId: true },
  });
  return task ?? undefined;
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
 * Mis tareas en el workspace (HU-28b, HU-35): donde mi persona del espacio aparece en Actividad,
 * Gestión o Seguimiento, de proyectos que no están en la papelera. Las abiertas y las Hechas desde
 * `doneSince` (para "hechas esta semana"); las canceladas no se piden.
 */
export async function listMyTasks(
  db: Db,
  workspaceId: string,
  userId: string,
  doneSince: Date,
): Promise<MyTask[]> {
  const me = await db.person.findFirst({ where: { workspaceId, userId }, select: { id: true } });
  if (!me) return [];
  const rows = await db.task.findMany({
    where: {
      workspaceId,
      ...notDeleted,
      project: notDeleted,
      AND: [
        {
          OR: [
            { activityPersonId: me.id },
            { managementPersonId: me.id },
            { followUpPersonId: me.id },
          ],
        },
        {
          OR: [
            { status: { in: ['PENDING', 'IN_PROGRESS', 'PAUSED'] } },
            { status: 'DONE', completedAt: { gte: doneSince } },
          ],
        },
      ],
    },
    select: { ...taskSelect, project: { select: { name: true } } },
    orderBy: [{ endDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  });
  return rows.map(({ project, ...row }) => {
    const myRoles: TaskRole[] = [];
    if (row.activityPerson?.id === me.id) myRoles.push('ACTIVITY');
    if (row.managementPerson?.id === me.id) myRoles.push('MANAGEMENT');
    if (row.followUpPerson?.id === me.id) myRoles.push('FOLLOW_UP');
    return { ...toTask(row), projectName: project.name, myRoles };
  });
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
