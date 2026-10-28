import {
  DEFAULT_TASK_ORIGINS,
  type CreateTaskOriginInput,
  type TaskOrigin,
  type UpdateTaskOriginInput,
} from '@gestion/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';

/** Ya hay otro origen activo con ese nombre en el espacio (→ 409) */
export class DuplicateOriginNameError extends Error {}
/** El origen pedido no existe en el espacio o está archivado (→ 400) */
export class InvalidTaskOriginError extends Error {}

const activeOrigin = { archivedAt: null } as const;

/** Orígenes iniciales de un espacio nuevo (HU-47); va dentro de seedCatalog */
export async function seedTaskOrigins(tx: Tx, workspaceId: string, actorId: string | null) {
  await tx.taskOrigin.createMany({
    data: DEFAULT_TASK_ORIGINS.map((name, position) => ({
      workspaceId,
      name,
      position,
      ...auditCreate(actorId),
    })),
  });
}

/** Catálogo de orígenes del espacio (HU-47), archivados incluidos, en su orden */
export async function listTaskOrigins(db: Db, workspaceId: string): Promise<TaskOrigin[]> {
  const rows = await db.taskOrigin.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      position: true,
      archivedAt: true,
      _count: { select: { tasks: { where: { ...notDeleted, project: notDeleted } } } },
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(({ archivedAt, _count, ...row }) => ({
    ...row,
    archived: archivedAt !== null,
    taskCount: _count.tasks,
  }));
}

async function nameTaken(db: Db | Tx, workspaceId: string, name: string, exceptId?: string) {
  const found = await db.taskOrigin.findFirst({
    where: {
      workspaceId,
      ...activeOrigin,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  return found !== null;
}

export async function createTaskOrigin(
  db: Db,
  actorId: string,
  workspaceId: string,
  { name }: CreateTaskOriginInput,
): Promise<void> {
  if (await nameTaken(db, workspaceId, name)) throw new DuplicateOriginNameError();
  const last = await db.taskOrigin.aggregate({ where: { workspaceId }, _max: { position: true } });
  await db.taskOrigin.create({
    data: {
      workspaceId,
      name,
      position: (last._max.position ?? -1) + 1,
      ...auditCreate(actorId),
    },
  });
}

/** false si el origen no es de ese espacio (→ 404) */
export async function updateTaskOrigin(
  db: Db,
  actorId: string,
  workspaceId: string,
  originId: string,
  { archived, name }: UpdateTaskOriginInput,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const origin = await tx.taskOrigin.findFirst({
      where: { id: originId, workspaceId },
      select: { name: true, archivedAt: true },
    });
    if (!origin) return false;

    const willBeActive = archived === undefined ? origin.archivedAt === null : !archived;
    if (willBeActive && (await nameTaken(tx, workspaceId, name ?? origin.name, originId))) {
      throw new DuplicateOriginNameError();
    }

    await tx.taskOrigin.update({
      where: { id: originId },
      data: {
        ...(name !== undefined && { name }),
        ...(archived !== undefined && {
          archivedAt: archived ? (origin.archivedAt ?? new Date()) : null,
        }),
        ...auditUpdate(actorId),
      },
    });
    return true;
  });
}

/**
 * Origen que recibirá una tarea: ninguno, el que ya tenía (aunque esté archivado) o uno activo del
 * catálogo del espacio. Si no, InvalidTaskOriginError (→ 400).
 */
export async function resolveTaskOrigin(
  db: Db,
  workspaceId: string,
  requested: string | null,
  current: string | null = null,
): Promise<string | null> {
  if (requested === null || requested === current) return requested;
  const found = await db.taskOrigin.count({
    where: { id: requested, workspaceId, ...activeOrigin },
  });
  if (found === 0) throw new InvalidTaskOriginError();
  return requested;
}
