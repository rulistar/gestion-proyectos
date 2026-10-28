import {
  countTaskActivity,
  summarizeTasks,
  type Project,
  type ProjectInput,
  type ProjectStatus,
  type TaskStatus,
} from '@gestion/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';
import { fromIsoDate, toIsoDate } from '../../db/dates.js';
import {
  assignablePeople,
  personSelect,
  toPersonRef,
  type PersonRow,
} from '../people/people.service.js';
import { resolveProjectType } from '../project-types/project-types.service.js';
import { resolveFolio } from './folios.js';

/** El tipo pedido no existe en el espacio o está archivado (→ 400) */
export class InvalidProjectTypeError extends Error {}

/** Alguna persona del proyecto no es del catálogo de este espacio o está archivada (→ 400) */
export class InvalidProjectPeopleError extends Error {}

/** Personas del proyecto (HU-36): referencias al catálogo */
type PersonKey =
  'requester' | 'assignedTo' | 'projectManager' | 'consultingManager' | 'businessPartner';

const PERSON_FIELDS = [
  'requesterId',
  'assignedToId',
  'projectManagerId',
  'consultingManagerId',
  'businessPartnerId',
] as const;

/**
 * Las personas pedidas deben ser activas del catálogo del espacio; al editar valen también las que
 * el proyecto ya tenía aunque estén archivadas (ADR-0005 §3)
 */
async function checkPeople(
  db: Db,
  workspaceId: string,
  input: ProjectInput,
  kept: (string | null)[] = [],
) {
  const requested = PERSON_FIELDS.map((field) => input[field]);
  if (!(await assignablePeople(db, workspaceId, requested, kept))) {
    throw new InvalidProjectPeopleError();
  }
}

/** El tipo nuevo no admite algunos tipos de tarea que ya tiene el proyecto (→ 409, ADR-0004 §4) */
export class DisallowedTaskTypesError extends Error {
  constructor(readonly taskTypes: string[]) {
    super('Tipos de tarea no admitidos');
  }
}

/** Algún tipo de tarea elegido no existe, está archivado o no lo admite el tipo (→ 400, HU-37) */
export class InvalidTaskTypeSelectionError extends Error {}

/** Tipos de tarea que admite un tipo de contenedor (HU-22); vacío = todos */
async function typeAllowedTaskTypes(db: Db, typeId: string) {
  const rows = await db.projectTypeTaskType.findMany({
    where: { projectTypeId: typeId },
    select: { taskTypeId: true },
  });
  return rows.map((row) => row.taskTypeId);
}

/**
 * Tipos de tarea propios del contenedor (HU-37, ADR-0005 §4), siempre un subconjunto de los que
 * admite su tipo. Sin pedirlos: al crear, ninguno; al editar, los que tenía, salvo que el tipo
 * nuevo ya no los admita (entonces se descartan). Al editar se conservan los archivados que tenía.
 */
async function resolveOwnTaskTypes(
  db: Db,
  workspaceId: string,
  typeAllowed: string[],
  requested: string[] | undefined,
  current: string[] = [],
): Promise<string[]> {
  const fits = (ids: string[]) =>
    typeAllowed.length === 0 || ids.every((id) => typeAllowed.includes(id));
  if (requested === undefined) return fits(current) ? current : [];

  const ids = [...new Set(requested)];
  if (!fits(ids)) throw new InvalidTaskTypeSelectionError();
  const fresh = ids.filter((id) => !current.includes(id));
  const valid = await db.taskType.count({
    where: { id: { in: fresh }, workspaceId, archivedAt: null },
  });
  if (valid !== fresh.length) throw new InvalidTaskTypeSelectionError();
  return ids;
}

/** Nombres de los tipos de tarea del proyecto que quedan fuera de `allowed` (vacío = todos) */
async function disallowedTaskTypes(db: Db, projectId: string, allowed: string[]) {
  if (allowed.length === 0) return [];
  const tasks = await db.task.findMany({
    where: { projectId, ...notDeleted, typeId: { notIn: allowed } },
    select: { type: { select: { name: true } } },
    distinct: ['typeId'],
  });
  return tasks.map((task) => task.type.name);
}

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
  requester: personSelect,
  assignedTo: personSelect,
  projectManager: personSelect,
  consultingManager: personSelect,
  businessPartner: personSelect,
  area: true,
  classification: true,
  status: true,
  priority: true,
  startDate: true,
  endDate: true,
  notes: true,
  sprint: true,
  sprintActivities: true,
  allowedTaskTypes: { select: { taskTypeId: true } },
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
  | 'startDate'
  | 'endDate'
  | 'startedAt'
  | 'finishedAt'
  | 'progress'
  | 'allowedTaskTypeIds'
  | PersonKey
> &
  Record<PersonKey, PersonRow> & {
    allowedTaskTypes: { taskTypeId: string }[];
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

function toProject(
  {
    tasks,
    allowedTaskTypes,
    requester,
    assignedTo,
    projectManager,
    consultingManager,
    businessPartner,
    ...row
  }: ProjectRow,
  metrics: Metrics,
): Project {
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
    allowedTaskTypeIds: allowedTaskTypes.map((allowed) => allowed.taskTypeId),
    requester: toPersonRef(requester, row.workspaceId),
    assignedTo: toPersonRef(assignedTo, row.workspaceId),
    projectManager: toPersonRef(projectManager, row.workspaceId),
    consultingManager: toPersonRef(consultingManager, row.workspaceId),
    businessPartner: toPersonRef(businessPartner, row.workspaceId),
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

/** Comportamiento del tipo: decide el prefijo del folio automático (HU-38) */
async function behaviorOf(tx: Tx, typeId: string) {
  const type = await tx.projectType.findUniqueOrThrow({
    where: { id: typeId },
    select: { behavior: true },
  });
  return type.behavior;
}

/** Los tipos de tarea propios van en su propia tabla: no son columnas del proyecto */
function toData({ taskTypeIds: _ownTypes, ...input }: ProjectInput, typeId: string) {
  return {
    ...input,
    typeId,
    startDate: fromIsoDate(input.startDate),
    endDate: fromIsoDate(input.endDate),
  };
}

/** Proyectos del workspace que no están en la papelera; los más recientes primero */
/** `visible`: el filtro de visibilidad de quien pregunta (ADR-0006); vacío = todos */
export async function listProjects(
  db: Db,
  workspaceId: string,
  metrics = defaultMetrics(),
  visible: Prisma.ProjectWhereInput = {},
): Promise<Project[]> {
  const rows = await db.project.findMany({
    where: { workspaceId, ...notDeleted, AND: [visible] },
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
  visible: Prisma.ProjectWhereInput = {},
): Promise<Project | null> {
  const row = await db.project.findFirst({
    where: { id: projectId, workspaceId, ...notDeleted, AND: [visible] },
    select: projectSelect,
  });
  return row && toProject(row, metrics);
}

export async function createProject(
  db: Db,
  actorId: string,
  workspaceId: string,
  input: ProjectInput,
  metrics = defaultMetrics(),
): Promise<Project> {
  const typeId = await resolveProjectType(db, workspaceId, input.typeId);
  if (!typeId) throw new InvalidProjectTypeError();
  await checkPeople(db, workspaceId, input);
  const ownTypes = await resolveOwnTaskTypes(
    db,
    workspaceId,
    await typeAllowedTaskTypes(db, typeId),
    input.taskTypeIds,
  );
  const row = await db.$transaction(async (tx) => {
    // Vacío o solo el formato → automático; uno de otro sistema se respeta si no está repetido (HU-38)
    const folio = await resolveFolio(tx, workspaceId, input.folio, {
      behavior: await behaviorOf(tx, typeId),
      today: metrics.today,
    });
    return tx.project.create({
      data: {
        workspaceId,
        ...toData({ ...input, folio }, typeId),
        ...realDatesFor(input.status, null),
        ...auditCreate(actorId),
        allowedTaskTypes: {
          create: ownTypes.map((taskTypeId) => ({ taskTypeId, createdById: actorId })),
        },
      },
      select: projectSelect,
    });
  });
  return toProject(row, metrics);
}

/** Reemplaza los datos del proyecto; null si no existe en ese workspace */
export async function updateProject(
  db: Db,
  actorId: string,
  workspaceId: string,
  projectId: string,
  input: ProjectInput,
  metrics = defaultMetrics(),
): Promise<Project | null> {
  const previous = await db.project.findFirst({
    where: { id: projectId, workspaceId, ...notDeleted },
    select: {
      typeId: true,
      folio: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      allowedTaskTypes: { select: { taskTypeId: true } },
      requesterId: true,
      assignedToId: true,
      projectManagerId: true,
      consultingManagerId: true,
      businessPartnerId: true,
    },
  });
  if (!previous) return null;
  await checkPeople(
    db,
    workspaceId,
    input,
    PERSON_FIELDS.map((field) => previous[field]),
  );
  const typeId = await resolveProjectType(db, workspaceId, input.typeId, previous.typeId);
  if (!typeId) throw new InvalidProjectTypeError();
  const typeAllowed = await typeAllowedTaskTypes(db, typeId);
  const currentOwn = previous.allowedTaskTypes.map((row) => row.taskTypeId);
  const ownTypes = await resolveOwnTaskTypes(
    db,
    workspaceId,
    typeAllowed,
    input.taskTypeIds,
    currentOwn,
  );
  // Sus tareas deben caber en lo que admitirá: su lista propia o, sin ella, la de su tipo (ADR-0004 §4)
  const conflicts = await disallowedTaskTypes(
    db,
    projectId,
    ownTypes.length > 0 ? ownTypes : typeAllowed,
  );
  if (conflicts.length > 0) throw new DisallowedTaskTypesError(conflicts);

  await db.$transaction(async (tx) => {
    const folio = await resolveFolio(tx, workspaceId, input.folio, {
      behavior: await behaviorOf(tx, typeId),
      today: metrics.today,
      current: { id: projectId, folio: previous.folio },
    });
    await tx.project.update({
      where: { id: projectId },
      data: {
        ...toData({ ...input, folio }, typeId),
        ...realDatesFor(input.status, previous),
        ...auditUpdate(actorId),
      },
    });
    // La lista propia se reemplaza completa solo si cambió
    if (ownTypes.join() !== currentOwn.join()) {
      await tx.projectTaskType.deleteMany({ where: { projectId } });
      await tx.projectTaskType.createMany({
        data: ownTypes.map((taskTypeId) => ({ projectId, taskTypeId, createdById: actorId })),
      });
    }
  });
  return getProject(db, workspaceId, projectId, metrics);
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
