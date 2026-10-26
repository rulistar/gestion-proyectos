import {
  DEFAULT_PROJECT_TYPES,
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

const activeType = { archivedAt: null } as const;

/** Carga los tipos iniciales (ADR-0004 §5) en un espacio recién creado */
export async function seedProjectTypes(tx: Tx, workspaceId: string, actorId: string | null) {
  await tx.projectType.createMany({
    data: DEFAULT_PROJECT_TYPES.map((type, position) => ({
      workspaceId,
      ...type,
      position,
      ...auditCreate(actorId),
    })),
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
      _count: { select: { projects: { where: notDeleted } } },
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(({ archivedAt, _count, ...row }) => ({
    ...row,
    archived: archivedAt !== null,
    projectCount: _count.projects,
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
  { archived, ...changes }: UpdateProjectTypeInput,
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
