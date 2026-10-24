import type { Task, TaskInput, TaskStatus } from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';
import { fromIsoDate, toIsoDate } from '../../db/dates.js';

const taskSelect = {
  id: true,
  projectId: true,
  title: true,
  type: true,
  status: true,
  estimatedMinutes: true,
  assigneeId: true,
  startDate: true,
  endDate: true,
  completedAt: true,
} as const;

type TaskRow = Omit<Task, 'startDate' | 'endDate' | 'completedAt'> & {
  startDate: Date | null;
  endDate: Date | null;
  completedAt: Date | null;
};

function toTask(row: TaskRow): Task {
  return {
    ...row,
    startDate: toIsoDate(row.startDate),
    endDate: toIsoDate(row.endDate),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
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

/** El proyecto ya se comprobó (existe en el workspace y no está borrado) */
export async function createTask(
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
  input: TaskInput,
): Promise<Task> {
  const row = await db.task.create({
    data: {
      workspaceId,
      projectId,
      ...input,
      startDate: fromIsoDate(input.startDate),
      endDate: fromIsoDate(input.endDate),
      completedAt: completedAtFor(input.status, null),
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
  changes: Partial<TaskInput> & { status: TaskStatus },
): Promise<Task | null> {
  const previous = await db.task.findFirst({
    where: { id: where.taskId, ...taskScope(where.workspaceId, where.projectId) },
    select: { status: true, completedAt: true },
  });
  if (!previous) return null;

  const row = await db.task.update({
    where: { id: where.taskId },
    data: {
      ...changes,
      ...(changes.startDate !== undefined && { startDate: fromIsoDate(changes.startDate) }),
      ...(changes.endDate !== undefined && { endDate: fromIsoDate(changes.endDate) }),
      completedAt: completedAtFor(changes.status, previous),
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
) {
  return applyUpdate(db, actorId, where, { status });
}
