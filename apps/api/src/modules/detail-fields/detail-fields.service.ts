import {
  removedOptions,
  type CreateDetailFieldData,
  type DetailField,
  type MoveDetailFieldInput,
  type UpdateDetailFieldInput,
} from '@gestion/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditUpdate } from '../../db/audit.js';

/** El tipo dueño no es de este espacio (→ 400) */
export class InvalidFieldOwnerError extends Error {}
/** Ya hay un campo activo con ese nombre en el mismo tipo (→ 409) */
export class DuplicateFieldNameError extends Error {}
/** Se quiso quitar una opción de una lista (→ 409): dejaría valores guardados inválidos */
export class RemovedOptionError extends Error {
  constructor(readonly options: string[]) {
    super();
  }
}
/** Opciones en un campo que no es lista (→ 400) */
export class OptionsNotAllowedError extends Error {}

const fieldSelect = {
  id: true,
  projectTypeId: true,
  taskTypeId: true,
  name: true,
  kind: true,
  required: true,
  options: true,
  position: true,
  archivedAt: true,
} as const;

/** Campos de detalle del espacio (HU-23), archivados incluidos, en su orden dentro de cada tipo */
export async function listDetailFields(db: Db, workspaceId: string): Promise<DetailField[]> {
  const rows = await db.detailField.findMany({
    where: { workspaceId },
    select: fieldSelect,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(({ archivedAt, ...row }) => ({ ...row, archived: archivedAt !== null }));
}

type Owner = { projectTypeId: string | null; taskTypeId: string | null };

/** Campos del mismo tipo dueño */
const sameOwner = ({ projectTypeId, taskTypeId }: Owner) =>
  projectTypeId ? { projectTypeId } : { taskTypeId: taskTypeId! };

async function nameTaken(tx: Db | Tx, owner: Owner, name: string, exceptId?: string) {
  const found = await tx.detailField.findFirst({
    where: {
      ...sameOwner(owner),
      archivedAt: null,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  return found !== null;
}

export async function createDetailField(
  db: Db,
  actorId: string,
  workspaceId: string,
  input: CreateDetailFieldData,
): Promise<void> {
  const owner: Owner = {
    projectTypeId: input.projectTypeId ?? null,
    taskTypeId: input.taskTypeId ?? null,
  };
  const ownerExists = owner.projectTypeId
    ? await db.projectType.count({ where: { id: owner.projectTypeId, workspaceId } })
    : await db.taskType.count({ where: { id: owner.taskTypeId!, workspaceId } });
  if (ownerExists === 0) throw new InvalidFieldOwnerError();
  if (await nameTaken(db, owner, input.name)) throw new DuplicateFieldNameError();
  const last = await db.detailField.aggregate({
    where: sameOwner(owner),
    _max: { position: true },
  });
  await db.detailField.create({
    data: {
      workspaceId,
      ...owner,
      name: input.name,
      kind: input.kind,
      required: input.required,
      options: input.options,
      position: (last._max.position ?? -1) + 1,
      ...auditCreate(actorId),
    },
  });
}

/** false si el campo no es de ese espacio (→ 404) */
export async function updateDetailField(
  db: Db,
  actorId: string,
  workspaceId: string,
  fieldId: string,
  { name, required, options, archived }: UpdateDetailFieldInput,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const field = await tx.detailField.findFirst({
      where: { id: fieldId, workspaceId },
      select: { name: true, kind: true, options: true, archivedAt: true, ...ownerSelect },
    });
    if (!field) return false;

    if (options !== undefined) {
      if (field.kind !== 'OPTIONS' && options.length > 0) throw new OptionsNotAllowedError();
      const removed = removedOptions(field.options, options);
      if (removed.length > 0) throw new RemovedOptionError(removed);
    }
    const willBeActive = archived === undefined ? field.archivedAt === null : !archived;
    if (willBeActive && (await nameTaken(tx, field, name ?? field.name, fieldId))) {
      throw new DuplicateFieldNameError();
    }

    await tx.detailField.update({
      where: { id: fieldId },
      data: {
        ...(name !== undefined && { name }),
        ...(required !== undefined && { required }),
        ...(options !== undefined && { options }),
        ...(archived !== undefined && {
          archivedAt: archived ? (field.archivedAt ?? new Date()) : null,
        }),
        ...auditUpdate(actorId),
      },
    });
    return true;
  });
}

const ownerSelect = { projectTypeId: true, taskTypeId: true } as const;

/**
 * Sube o baja el campo entre los del mismo tipo (intercambia el lugar con el vecino); en el primero
 * o el último no hace nada. false si no existe en ese espacio (→ 404).
 */
export async function moveDetailField(
  db: Db,
  actorId: string,
  workspaceId: string,
  fieldId: string,
  { direction }: MoveDetailFieldInput,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const field = await tx.detailField.findFirst({
      where: { id: fieldId, workspaceId },
      select: ownerSelect,
    });
    if (!field) return false;
    const siblings = await tx.detailField.findMany({
      where: { ...sameOwner(field), archivedAt: null },
      select: { id: true, position: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const ids = siblings.map((sibling) => sibling.id);
    const from = ids.indexOf(fieldId);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ids.length) return true;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    // Se renumeran todos: así el orden queda limpio aunque hubiera posiciones repetidas
    for (const [position, id] of ids.entries()) {
      if (siblings.find((sibling) => sibling.id === id)!.position === position) continue;
      await tx.detailField.update({ where: { id }, data: { position, ...auditUpdate(actorId) } });
    }
    return true;
  });
}
