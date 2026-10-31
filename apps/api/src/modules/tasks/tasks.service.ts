import {
  ALL_PEOPLE,
  statusNeedsReason,
  type MyTask,
  type Task,
  type TaskInput,
  type TaskStatus,
  type WorkspaceTask,
} from '@gestion/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../../db/client.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';
import { fromIsoDate, toIsoDate } from '../../db/dates.js';
import { parseDetails, resolveDetails } from '../detail-fields/detail-fields.service.js';
import { personSelect, toPersonRef, type PersonRow } from '../people/people.service.js';
import { resolvePhase } from '../phases/phases.service.js';
import { resolveTaskOrigin } from '../task-origins/task-origins.service.js';
import { resolveTaskType } from '../task-types/task-types.service.js';
import type { WorkspaceAccess } from '../workspaces/access.js';

/** El tipo pedido no existe, está archivado o no lo admite el tipo del proyecto (→ 400) */
export class InvalidTaskTypeError extends Error {}

const taskSelect = {
  id: true,
  projectId: true,
  phaseId: true,
  title: true,
  type: { select: { id: true, name: true, expedited: true } },
  status: true,
  estimatedMinutes: true,
  startDate: true,
  endDate: true,
  completedAt: true,
  startedAt: true,
  statusReason: true,
  createdById: true,
  origin: { select: { id: true, name: true } },
  originDetail: true,
  details: true,
  workspaceId: true,
  // Responsable (HU-35): persona del catálogo, con su acceso al espacio
  responsiblePerson: personSelect,
} as const;

type TaskRow = Omit<
  Task,
  'startDate' | 'endDate' | 'completedAt' | 'startedAt' | 'responsible' | 'details'
> & {
  details: unknown;
  startDate: Date | null;
  endDate: Date | null;
  completedAt: Date | null;
  startedAt: Date | null;
  workspaceId: string;
  responsiblePerson: PersonRow;
};

function toTask({ workspaceId, responsiblePerson, ...row }: TaskRow): Task {
  return {
    ...row,
    responsible: toPersonRef(responsiblePerson, workspaceId),
    startDate: toIsoDate(row.startDate),
    endDate: toIsoDate(row.endDate),
    completedAt: row.completedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    details: parseDetails(row.details),
  };
}

/** Responsable actual de una tarea del proyecto (undefined si la tarea no existe) */
export async function currentResponsible(
  db: Db,
  where: { workspaceId: string; projectId: string; taskId: string },
): Promise<string | null | undefined> {
  const task = await db.task.findFirst({
    where: { id: where.taskId, ...taskScope(where.workspaceId, where.projectId) },
    select: { responsiblePersonId: true },
  });
  return task === null ? undefined : task.responsiblePersonId;
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

/** `visible`: las tareas que ve quien pregunta (ADR-0006); vacío = todas */
export async function listTasks(
  db: Db,
  workspaceId: string,
  projectId: string,
  visible: Prisma.TaskWhereInput = {},
): Promise<Task[]> {
  const rows = await db.task.findMany({
    where: { ...taskScope(workspaceId, projectId), AND: [visible] },
    select: taskSelect,
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(toTask);
}

/**
 * Mis tareas en el workspace (HU-28b): donde mi persona del espacio es la Responsable, de proyectos
 * que no están en la papelera. Las abiertas y las Hechas desde `doneSince` (para "hechas esta
 * semana"); las canceladas no se piden.
 *
 * `person` (HU-52): ver el trabajo de otra persona que puedo ver, o `all` = yo y las que sigo. El
 * Admin ve el de cualquiera, y con `all` todas las tareas (también las que no tienen Responsable).
 * null = esa persona no la puedo ver (→ 404).
 */
export async function listMyTasks(
  db: Db,
  access: WorkspaceAccess,
  doneSince: Date,
  person?: string,
): Promise<MyTask[] | null> {
  const isAdmin = access.role === 'ADMIN';
  const mine = access.personId ? [access.personId] : [];
  const canSee = [...mine, ...access.watchedPersonIds];
  let responsible: Prisma.TaskWhereInput;
  if (person === undefined) {
    if (!access.personId) return [];
    responsible = { responsiblePersonId: access.personId };
  } else if (person === ALL_PEOPLE) {
    responsible = isAdmin ? {} : { responsiblePersonId: { in: canSee } };
  } else {
    if (!isAdmin && !canSee.includes(person)) return null;
    responsible = { responsiblePersonId: person };
  }
  const rows = await db.task.findMany({
    where: {
      workspaceId: access.workspaceId,
      ...responsible,
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

/**
 * Todas las tareas del espacio con su contenedor (HU-39, vista "Tareas"), de contenedores que no
 * están en la papelera; por fecha de fin (sin fecha al final). Los filtros se aplican en la web.
 */
export async function listWorkspaceTasks(
  db: Db,
  workspaceId: string,
  visible: Prisma.TaskWhereInput = {},
): Promise<WorkspaceTask[]> {
  const rows = await db.task.findMany({
    where: { workspaceId, ...notDeleted, project: notDeleted, AND: [visible] },
    select: {
      ...taskSelect,
      project: {
        select: {
          id: true,
          name: true,
          folio: true,
          createdById: true,
          scope: true,
          type: { select: { id: true, name: true, behavior: true } },
        },
      },
    },
    orderBy: [{ endDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
  });
  return rows.map(({ project, ...row }) => ({ ...toTask(row), project }));
}

/** El proyecto ya se comprobó (existe en el workspace y no está borrado) */
export async function createTask(
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
  {
    typeId: requestedType,
    originId: requestedOrigin,
    phaseId: requestedPhase,
    details: requestedDetails,
    ...input
  }: TaskInput,
): Promise<Task> {
  const typeId = await resolveTaskType(db, workspaceId, projectId, requestedType);
  if (!typeId) throw new InvalidTaskTypeError();
  // Los campos obligatorios de su tipo se piden también al crear (HU-23b)
  const details = await resolveDetails(db, { taskTypeId: typeId }, requestedDetails);
  const originId = await resolveTaskOrigin(db, workspaceId, requestedOrigin);
  const phaseId = await resolvePhase(db, workspaceId, projectId, requestedPhase);
  const row = await db.task.create({
    data: {
      workspaceId,
      projectId,
      ...input,
      typeId,
      originId,
      phaseId,
      details,
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
  {
    typeId: requestedType,
    originId: requestedOrigin,
    phaseId: requestedPhase,
    details: requestedDetails,
    ...changes
  }: Partial<TaskInput> & { status: TaskStatus },
): Promise<Task | null> {
  const previous = await db.task.findFirst({
    where: { id: where.taskId, ...taskScope(where.workspaceId, where.projectId) },
    select: {
      status: true,
      completedAt: true,
      startedAt: true,
      typeId: true,
      originId: true,
      phaseId: true,
      details: true,
    },
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
  // Igual con el origen: mover de columna no lo cambia; al editar vale el que ya tenía
  const originId =
    requestedOrigin === undefined
      ? previous.originId
      : await resolveTaskOrigin(db, where.workspaceId, requestedOrigin, previous.originId);
  // Sin phaseId (mover de columna, o un cliente que no lo envía) se conserva la fase
  const phaseId = await resolvePhase(
    db,
    where.workspaceId,
    where.projectId,
    requestedPhase,
    previous.phaseId,
  );

  // Mover de columna no toca el detalle; editar (o cambiar de tipo) lo valida contra su tipo
  const details =
    requestedDetails === undefined && typeId === previous.typeId
      ? undefined
      : await resolveDetails(
          db,
          { taskTypeId: typeId },
          requestedDetails,
          parseDetails(previous.details),
        );

  const row = await db.task.update({
    where: { id: where.taskId },
    data: {
      ...changes,
      typeId,
      originId,
      phaseId,
      ...(details !== undefined && { details }),
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
