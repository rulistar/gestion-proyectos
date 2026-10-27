import type { CreatePersonInput, Person, PersonRef, UpdatePersonInput } from '@gestion/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';

/** Ya hay otra persona activa con ese nombre en el espacio (→ 409) */
export class DuplicatePersonNameError extends Error {}
/** El usuario ya está vinculado a otra persona del espacio (→ 409) */
export class UserAlreadyLinkedError extends Error {}
/** Solo se vincula a usuarios que son miembros activos del espacio (→ 400) */
export class NotAMemberError extends Error {}

const activePerson = { archivedAt: null } as const;

/** Lo que se lee de una persona asignada (tarea o proyecto): si su cuenta sigue con acceso */
export const personSelect = {
  select: {
    id: true,
    name: true,
    userId: true,
    archivedAt: true,
    user: {
      select: { status: true, memberships: { where: notDeleted, select: { workspaceId: true } } },
    },
  },
} as const;

export type PersonRow = {
  id: string;
  name: string;
  userId: string | null;
  archivedAt: Date | null;
  user: { status: string; memberships: { workspaceId: string }[] } | null;
} | null;

export function toPersonRef(person: PersonRow, workspaceId: string): PersonRef | null {
  if (!person) return null;
  const { archivedAt, user, ...rest } = person;
  return {
    ...rest,
    // Sin cuenta no hay acceso que perder; con cuenta, debe seguir siendo miembro (ADR-0005 §1)
    hasAccess:
      user !== null &&
      user.status === 'ACTIVE' &&
      user.memberships.some((m) => m.workspaceId === workspaceId),
    archived: archivedAt !== null,
  };
}

async function nameTaken(db: Db | Tx, workspaceId: string, name: string, exceptId?: string) {
  const found = await db.person.findFirst({
    where: {
      workspaceId,
      ...activePerson,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  return found !== null;
}

/**
 * Persona vinculada a un miembro (ADR-0005 §1): se crea al crear el espacio o al aceptar una
 * invitación, con el nombre de la cuenta. Si ya tenía una, no se toca (conserva su alias). Si el
 * nombre ya lo usa otra persona, se le agrega el correo para distinguirlas.
 */
export async function ensureMemberPerson(
  tx: Tx,
  workspaceId: string,
  user: { id: string; name: string; email: string },
  actorId: string | null,
) {
  const existing = await tx.person.findFirst({
    where: { workspaceId, userId: user.id },
    select: { id: true, archivedAt: true },
  });
  if (existing) {
    // Vuelve a entrar al espacio: su persona deja de estar archivada
    if (existing.archivedAt) {
      await tx.person.update({ where: { id: existing.id }, data: { archivedAt: null } });
    }
    return;
  }
  const name = (await nameTaken(tx, workspaceId, user.name))
    ? `${user.name} (${user.email})`
    : user.name;
  await tx.person.create({
    data: { workspaceId, name, userId: user.id, ...auditCreate(actorId) },
  });
}

/** Catálogo del espacio, archivadas incluidas, por nombre */
export async function listPeople(db: Db, workspaceId: string): Promise<Person[]> {
  const rows = await db.person.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      userId: true,
      archivedAt: true,
      user: {
        select: {
          name: true,
          status: true,
          memberships: { where: { workspaceId, ...notDeleted }, select: { id: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  return rows.map(({ archivedAt, user, ...row }) => ({
    ...row,
    userName: user?.name ?? null,
    // Sin cuenta no hay acceso que perder; con cuenta, debe seguir siendo miembro activo
    hasAccess: user !== null && user.status === 'ACTIVE' && user.memberships.length > 0,
    archived: archivedAt !== null,
  }));
}

export async function createPerson(
  db: Db,
  actorId: string,
  workspaceId: string,
  { name }: CreatePersonInput,
): Promise<string> {
  if (await nameTaken(db, workspaceId, name)) throw new DuplicatePersonNameError();
  const person = await db.person.create({
    data: { workspaceId, name, ...auditCreate(actorId) },
    select: { id: true },
  });
  return person.id;
}

/** false si la persona no es de ese espacio (→ 404) */
export async function updatePerson(
  db: Db,
  actorId: string,
  workspaceId: string,
  personId: string,
  { name, userId, archived }: UpdatePersonInput,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const person = await tx.person.findFirst({
      where: { id: personId, workspaceId },
      select: { name: true, archivedAt: true },
    });
    if (!person) return false;

    const willBeActive = archived === undefined ? person.archivedAt === null : !archived;
    if (willBeActive && (await nameTaken(tx, workspaceId, name ?? person.name, personId))) {
      throw new DuplicatePersonNameError();
    }
    if (userId) {
      const member = await tx.membership.count({ where: { workspaceId, userId, ...notDeleted } });
      if (member === 0) throw new NotAMemberError();
      const linked = await tx.person.findFirst({
        where: { workspaceId, userId, id: { not: personId } },
        select: { id: true },
      });
      if (linked) throw new UserAlreadyLinkedError();
    }

    await tx.person.update({
      where: { id: personId },
      data: {
        ...(name !== undefined && { name }),
        ...(userId !== undefined && { userId }),
        ...(archived !== undefined && {
          archivedAt: archived ? (person.archivedAt ?? new Date()) : null,
        }),
        ...auditUpdate(actorId),
      },
    });
    return true;
  });
}

/**
 * ¿Todas las personas pedidas pueden asignarse en el espacio? Deben ser activas del catálogo; las
 * que la tarea ya tenía (`kept`) valen aunque estén archivadas (HU-35)
 */
export async function assignablePeople(
  db: Db,
  workspaceId: string,
  requested: (string | null)[],
  kept: (string | null)[] = [],
): Promise<boolean> {
  const ids = [
    ...new Set(requested.filter((id): id is string => id !== null && !kept.includes(id))),
  ];
  if (ids.length === 0) return true;
  const found = await db.person.count({ where: { id: { in: ids }, workspaceId, ...activePerson } });
  return found === ids.length;
}

/**
 * Nombre que se muestra de cada usuario en el espacio (ADR-0005 §1): el de su persona vinculada
 * ("Rodrigo") o, si no tiene, el de su cuenta
 */
export async function displayNames(
  db: Db | Tx,
  workspaceId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  const people = await db.person.findMany({
    where: { workspaceId, userId: { in: userIds } },
    select: { userId: true, name: true },
  });
  return new Map(people.map((person) => [person.userId!, person.name]));
}
