import {
  countTaskActivity,
  summarizeTasks,
  type Project,
  type ProjectInput,
  type ProjectStatus,
  type TaskStatus,
} from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';
import { fromIsoDate, toIsoDate } from '../../db/dates.js';
import { resolveProjectType } from '../project-types/project-types.service.js';

/** El tipo pedido no existe en el espacio o está archivado (→ 400) */
export class InvalidProjectTypeError extends Error {}

/** Fecha local del usuario para "vencidas" y "hechas este mes" (ADR-0004 §2) */
export interface Metrics {
  today: string;
  monthStart: string;
}

/** Sin datos del usuario se usan el día y el mes en UTC */
export function defaultMetrics(now = new Date()): Metrics {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { today: now.toISOString().slice(0, 10), monthStart: monthStart.toISOString() };
}

const projectSelect = {
  id: true,
  workspaceId: true,
  type: { select: { id: true, name: true, behavior: true } },
  name: true,
  folio: true,
  description: true,
  requester: true,
  assignedTo: true,
  projectManager: true,
  consultingManager: true,
  businessPartner: true,
  area: true,
  classification: true,
  status: true,
  priority: true,
  startDate: true,
  endDate: true,
  notes: true,
  startedAt: true,
  finishedAt: true,
  // Para medir el avance (HU-06, ADR-0004 §2); las tareas en la papelera no cuentan (RNF-05)
  tasks: {
    where: notDeleted,
    select: { status: true, estimatedMinutes: true, endDate: true, completedAt: true },
  },
} as const;

type ProjectRow = Omit<
  Project,
  'startDate' | 'endDate' | 'startedAt' | 'finishedAt' | 'progress'
> & {
  startDate: Date | null;
  endDate: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  tasks: {
    status: TaskStatus;
    estimatedMinutes: number | null;
    endDate: Date | null;
    completedAt: Date | null;
  }[];
};

function toProject({ tasks, ...row }: ProjectRow, metrics: Metrics): Project {
  const activity = tasks.map((task) => ({
    status: task.status,
    endDate: toIsoDate(task.endDate),
    completedAt: task.completedAt?.toISOString() ?? null,
  }));
  return {
    ...row,
    startDate: toIsoDate(row.startDate),
    endDate: toIsoDate(row.endDate),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    progress: { ...summarizeTasks(tasks), ...countTaskActivity(activity, metrics) },
  };
}

const FINISHED: readonly ProjectStatus[] = ['DONE', 'CANCELLED'];

/**
 * Fechas reales del contenedor (ADR-0004 §2.1): el inicio se registra la primera vez que pasa a
 * En curso (o a Terminado, si se salta En curso) y nunca se borra; el fin, al pasar a Terminado o
 * Cancelado, y se vacía si se reabre.
 */
export function realDatesFor(
  status: ProjectStatus,
  previous: { status: ProjectStatus; startedAt: Date | null; finishedAt: Date | null } | null,
  now = new Date(),
): { startedAt: Date | null; finishedAt: Date | null } {
  const startedAt =
    previous?.startedAt ?? (status === 'IN_PROGRESS' || status === 'DONE' ? now : null);
  if (!FINISHED.includes(status)) return { startedAt, finishedAt: null };
  const wasFinished = previous !== null && FINISHED.includes(previous.status);
  return { startedAt, finishedAt: wasFinished ? previous.finishedAt : now };
}

function toData(input: ProjectInput, typeId: string) {
  return {
    ...input,
    typeId,
    startDate: fromIsoDate(input.startDate),
    endDate: fromIsoDate(input.endDate),
  };
}

/** Proyectos del workspace que no están en la papelera; los más recientes primero */
export async function listProjects(
  db: Db,
  workspaceId: string,
  metrics = defaultMetrics(),
): Promise<Project[]> {
  const rows = await db.project.findMany({
    where: { workspaceId, ...notDeleted },
    select: projectSelect,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => toProject(row, metrics));
}

/** Un proyecto, solo si pertenece al workspace: el ID de otro workspace da null (→ 404) */
export async function getProject(
  db: Db,
  workspaceId: string,
  projectId: string,
  metrics = defaultMetrics(),
): Promise<Project | null> {
  const row = await db.project.findFirst({
    where: { id: projectId, workspaceId, ...notDeleted },
    select: projectSelect,
  });
  return row && toProject(row, metrics);
}

export async function createProject(
  db: Db,
  actorId: string,
  workspaceId: string,
  input: ProjectInput,
): Promise<Project> {
  const typeId = await resolveProjectType(db, workspaceId, input.typeId);
  if (!typeId) throw new InvalidProjectTypeError();
  const row = await db.project.create({
    data: {
      workspaceId,
      ...toData(input, typeId),
      ...realDatesFor(input.status, null),
      ...auditCreate(actorId),
    },
    select: projectSelect,
  });
  return toProject(row, defaultMetrics());
}

/** Reemplaza los datos del proyecto; null si no existe en ese workspace */
export async function updateProject(
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
  input: ProjectInput,
): Promise<Project | null> {
  const previous = await db.project.findFirst({
    where: { id: projectId, workspaceId, ...notDeleted },
    select: { typeId: true, status: true, startedAt: true, finishedAt: true },
  });
  if (!previous) return null;
  const typeId = await resolveProjectType(db, workspaceId, input.typeId, previous.typeId);
  if (!typeId) throw new InvalidProjectTypeError();

  await db.project.update({
    where: { id: projectId },
    data: {
      ...toData(input, typeId),
      ...realDatesFor(input.status, previous),
      ...auditUpdate(actorId),
    },
  });
  return getProject(db, workspaceId, projectId);
}

/**
 * Manda el proyecto a la papelera (HU-15). Sus tareas no se tocan: dejan de verse porque su
 * proyecto está borrado, y vuelven con él al restaurarlo. false si no existe (→ 404).
 */
export async function softDeleteProject(
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
): Promise<boolean> {
  const { count } = await db.project.updateMany({
    where: { id: projectId, workspaceId, ...notDeleted },
    data: auditSoftDelete(actorId),
  });
  return count > 0;
}
