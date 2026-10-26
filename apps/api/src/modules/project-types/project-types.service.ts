import {
  DEFAULT_ALLOWED_TASK_TYPES,
  DEFAULT_PROJECT_TYPES,
  DEFAULT_TASK_TYPES,
  type CreateProjectTypeInput,
  type ProjectType,
  type UpdateProjectTypeInput,
} from '@gestion/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';

/** El nombre ya lo usa otro tipo activo del espacio (→ 409) */
export class DuplicateTypeNameError extends Error {}
/** Archivar el último tipo activo dejaría el espacio sin poder crear nada (→ 409) */
export class LastActiveTypeError extends Error {}
/** Algún tipo de tarea permitido no es del espacio (→ 400) */
export class InvalidTaskTypesError extends Error {}

const activeType = { archivedAt: null } as const;

/**
 * Carga el catálogo inicial (ADR-0004 §5) en un espacio recién creado: tipos de contenedor, tipos
 * de tarea y los tipos de tarea que admite cada mantenimiento
 */
export async function seedCatalog(tx: Tx, workspaceId: string, actorId: string | null) {
  const projectTypes = await tx.projectType.createManyAndReturn({
    data: DEFAULT_PROJECT_TYPES.map((type, position) => ({
      workspaceId,
      ...type,
      position,
      ...auditCreate(actorId),
    })),
    select: { id: true, name: true },
  });
  const taskTypes = await tx.taskType.createManyAndReturn({
    data: DEFAULT_TASK_TYPES.map(({ name, expedited }, position) => ({
      workspaceId,
      name,
      expedited,
      position,
      ...auditCreate(actorId),
    })),
    select: { id: true, name: true },
  });
  const taskTypeId = new Map(taskTypes.map((type) => [type.name, type.id]));
  await tx.projectTypeTaskType.createMany({
    data: projectTypes.flatMap((projectType) =>
      (DEFAULT_ALLOWED_TASK_TYPES[projectType.name] ?? []).map((name) => ({
        projectTypeId: projectType.id,
        taskTypeId: taskTypeId.get(name)!,
        createdById: actorId,
      })),
    ),
  });
}

/** Catálogo del espacio, archivados incluidos, en su orden */
export async function listProjectTypes(db: Db, workspaceId: string): Promise<ProjectType[]> {
  const rows = await db.projectType.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      behavior: true,
      position: true,
      archivedAt: true,
      allowedTaskTypes: { select: { taskTypeId: true } },
      _count: { select: { projects: { where: notDeleted } } },
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(({ archivedAt, allowedTaskTypes, _count, ...row }) => ({
    ...row,
    archived: archivedAt !== null,
    projectCount: _count.projects,
    allowedTaskTypeIds: allowedTaskTypes.map((allowed) => allowed.taskTypeId),
  }));
}

async function nameTaken(db: Db | Tx, workspaceId: string, name: string, exceptId?: string) {
  const found = await db.projectType.findFirst({
    where: {
      workspaceId,
      ...activeType,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  return found !== null;
}

export async function createProjectType(
  db: Db,
  actorId: string,
  workspaceId: string,
  input: CreateProjectTypeInput,
): Promise<void> {
  if (await nameTaken(db, workspaceId, input.name)) throw new DuplicateTypeNameError();
  const last = await db.projectType.aggregate({
    where: { workspaceId },
    _max: { position: true },
  });
  await db.projectType.create({
    data: {
      workspaceId,
      ...input,
      position: (last._max.position ?? -1) + 1,
      ...auditCreate(actorId),
    },
  });
}

/** false si el tipo no es de ese espacio (→ 404) */
export async function updateProjectType(
  db: Db,
  actorId: string,
  workspaceId: string,
  typeId: string,
  { archived, allowedTaskTypeIds, ...changes }: UpdateProjectTypeInput,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const type = await tx.projectType.findFirst({
      where: { id: typeId, workspaceId },
      select: { name: true, archivedAt: true },
    });
    if (!type) return false;

    const willBeActive = archived === undefined ? type.archivedAt === null : !archived;
    // Al reactivar o renombrar, el nombre no debe chocar con otro tipo activo
    if (willBeActive && (await nameTaken(tx, workspaceId, changes.name ?? type.name, typeId))) {
      throw new DuplicateTypeNameError();
    }
    if (archived === true && type.archivedAt === null) {
      const active = await tx.projectType.count({ where: { workspaceId, ...activeType } });
      if (active <= 1) throw new LastActiveTypeError();
    }

    if (allowedTaskTypeIds !== undefined) {
      const ids = [...new Set(allowedTaskTypeIds)];
      const owned = await tx.taskType.count({ where: { id: { in: ids }, workspaceId } });
      if (owned !== ids.length) throw new InvalidTaskTypesError();
      // Se reemplaza la lista completa; vacía = admite todos (HU-22)
      await tx.projectTypeTaskType.deleteMany({ where: { projectTypeId: typeId } });
      await tx.projectTypeTaskType.createMany({
        data: ids.map((taskTypeId) => ({
          projectTypeId: typeId,
          taskTypeId,
          createdById: actorId,
        })),
      });
    }

    await tx.projectType.update({
      where: { id: typeId },
      data: {
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.behavior !== undefined && { behavior: changes.behavior }),
        ...(archived !== undefined && {
          archivedAt: archived ? (type.archivedAt ?? new Date()) : null,
        }),
        ...auditUpdate(actorId),
      },
    });
    return true;
  });
}

/**
 * Tipo que recibirá un proyecto: el pedido (activo y del espacio; al editar también sirve el que
 * ya tenía aunque esté archivado) o, si no se pidió, el primer tipo activo "Con fin".
 * null si el pedido no es válido (→ 400).
 */
export async function resolveProjectType(
  db: Db,
  workspaceId: string,
  requested: string | null,
  current?: string,
): Promise<string | null> {
  if (requested === null) {
    if (current) return current;
    const fallback = await db.projectType.findFirst({
      where: { workspaceId, ...activeType },
      orderBy: [{ behavior: 'asc' }, { position: 'asc' }],
      select: { id: true },
    });
    return fallback?.id ?? null;
  }
  if (requested === current) return requested;
  const type = await db.projectType.findFirst({
    where: { id: requested, workspaceId, ...activeType },
    select: { id: true },
  });
  return type?.id ?? null;
}
