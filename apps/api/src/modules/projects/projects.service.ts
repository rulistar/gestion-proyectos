import { summarizeTasks, type Project, type ProjectInput, type TaskStatus } from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';
import { fromIsoDate, toIsoDate } from '../../db/dates.js';

const projectSelect = {
  id: true,
  workspaceId: true,
  name: true,
  area: true,
  classification: true,
  status: true,
  priority: true,
  startDate: true,
  endDate: true,
  notes: true,
  // Para calcular el avance (HU-06); las tareas en la papelera no cuentan (RNF-05)
  tasks: { where: notDeleted, select: { status: true, estimatedMinutes: true } },
} as const;

type ProjectRow = Omit<Project, 'startDate' | 'endDate' | 'progress'> & {
  startDate: Date | null;
  endDate: Date | null;
  tasks: { status: TaskStatus; estimatedMinutes: number | null }[];
};

function toProject({ tasks, ...row }: ProjectRow): Project {
  return {
    ...row,
    startDate: toIsoDate(row.startDate),
    endDate: toIsoDate(row.endDate),
    progress: summarizeTasks(tasks),
  };
}

function toData(input: ProjectInput) {
  return {
    ...input,
    startDate: fromIsoDate(input.startDate),
    endDate: fromIsoDate(input.endDate),
  };
}

/** Proyectos del workspace que no están en la papelera; los más recientes primero */
export async function listProjects(db: Db, workspaceId: string): Promise<Project[]> {
  const rows = await db.project.findMany({
    where: { workspaceId, ...notDeleted },
    select: projectSelect,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toProject);
}

/** Un proyecto, solo si pertenece al workspace: el ID de otro workspace da null (→ 404) */
export async function getProject(
  db: Db,
  workspaceId: string,
  projectId: string,
): Promise<Project | null> {
  const row = await db.project.findFirst({
    where: { id: projectId, workspaceId, ...notDeleted },
    select: projectSelect,
  });
  return row && toProject(row);
}

export async function createProject(
  db: Db,
  actorId: string,
  workspaceId: string,
  input: ProjectInput,
): Promise<Project> {
  const row = await db.project.create({
    data: { workspaceId, ...toData(input), ...auditCreate(actorId) },
    select: projectSelect,
  });
  return toProject(row);
}

/** Reemplaza los datos del proyecto; null si no existe en ese workspace */
export async function updateProject(
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
  input: ProjectInput,
): Promise<Project | null> {
  const { count } = await db.project.updateMany({
    where: { id: projectId, workspaceId, ...notDeleted },
    data: { ...toData(input), ...auditUpdate(actorId) },
  });
  return count === 0 ? null : getProject(db, workspaceId, projectId);
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
