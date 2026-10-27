import type { CreateTaskTypeInput, TaskType, UpdateTaskTypeInput } from '@gestion/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';
import {
  DuplicateTypeNameError,
  LastActiveTypeError,
} from '../project-types/project-types.service.js';

const activeType = { archivedAt: null } as const;

/** Catálogo de tipos de tarea del espacio (HU-22), archivados incluidos, en su orden */
export async function listTaskTypes(db: Db, workspaceId: string): Promise<TaskType[]> {
  const rows = await db.taskType.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      expedited: true,
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
  const found = await db.taskType.findFirst({
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

export async function createTaskType(
  db: Db,
  actorId: string,
  workspaceId: string,
  input: CreateTaskTypeInput,
): Promise<void> {
  if (await nameTaken(db, workspaceId, input.name)) throw new DuplicateTypeNameError();
  const last = await db.taskType.aggregate({ where: { workspaceId }, _max: { position: true } });
  await db.taskType.create({
    data: {
      workspaceId,
      ...input,
      position: (last._max.position ?? -1) + 1,
      ...auditCreate(actorId),
    },
  });
}

/** false si el tipo no es de ese espacio (→ 404) */
export async function updateTaskType(
  db: Db,
  actorId: string,
  workspaceId: string,
  typeId: string,
  { archived, name, expedited }: UpdateTaskTypeInput,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const type = await tx.taskType.findFirst({
      where: { id: typeId, workspaceId },
      select: { name: true, archivedAt: true },
    });
    if (!type) return false;

    const willBeActive = archived === undefined ? type.archivedAt === null : !archived;
    if (willBeActive && (await nameTaken(tx, workspaceId, name ?? type.name, typeId))) {
      throw new DuplicateTypeNameError();
    }
    if (archived === true && type.archivedAt === null) {
      const active = await tx.taskType.count({ where: { workspaceId, ...activeType } });
      if (active <= 1) throw new LastActiveTypeError();
    }

    await tx.taskType.update({
      where: { id: typeId },
      data: {
        ...(name !== undefined && { name }),
        ...(expedited !== undefined && { expedited }),
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
 * Tipo que recibirá una tarea del proyecto: el pedido, si está activo, es del espacio y lo admite
 * el tipo del proyecto (al editar también vale el que ya tenía); sin pedido, el actual o el primer
 * tipo activo permitido. null si no es válido (→ 400).
 */
export async function resolveTaskType(
  db: Db,
  workspaceId: string,
  projectId: string,
  requested: string | null,
  current?: string,
): Promise<string | null> {
  if (requested === null && current) return current;
  if (requested !== null && requested === current) return requested;

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      allowedTaskTypes: { select: { taskTypeId: true } },
      type: { select: { allowedTaskTypes: { select: { taskTypeId: true } } } },
    },
  });
  if (!project) return null;
  // Los propios del contenedor (HU-37) o, sin ellos, los de su tipo (HU-22); vacío = todos
  const own = project.allowedTaskTypes.map((row) => row.taskTypeId);
  const allowed = own.length > 0 ? own : project.type.allowedTaskTypes.map((row) => row.taskTypeId);
  if (requested !== null && allowed.length > 0 && !allowed.includes(requested)) return null;

  const type = await db.taskType.findFirst({
    where: {
      workspaceId,
      ...activeType,
      ...(requested !== null ? { id: requested } : allowed.length > 0 && { id: { in: allowed } }),
    },
    orderBy: { position: 'asc' },
    select: { id: true },
  });
  return type?.id ?? null;
}
