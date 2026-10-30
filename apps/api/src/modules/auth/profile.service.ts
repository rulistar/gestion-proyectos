import type { ChangeMyEmailInput, ChangeMyPasswordInput } from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditUpdate } from '../../db/audit.js';
import { renameLinkedPeople } from '../people/people.service.js';
import { hashPassword, verifyPassword } from './password.js';

/** La contraseña actual no es la correcta (→ 400, en el campo de la contraseña actual) */
export class WrongPasswordError extends Error {}
/** El correo nuevo ya lo usa otra cuenta (→ 409) */
export class EmailTakenError extends Error {}

/** Lo que identifica la sesión desde la que se hace el cambio: esa se conserva */
interface Me {
  userId: string;
  tokenHash: string;
}

async function checkPassword(db: Db, userId: string, password: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    throw new WrongPasswordError();
  }
}

/** Cierra mis demás sesiones (HU-29): si alguien más tenía una abierta, deja de servirle */
function closeOtherSessions(db: Db, { userId, tokenHash }: Me) {
  return db.session.deleteMany({ where: { userId, tokenHash: { not: tokenHash } } });
}

/** Mi nombre (HU-29); también el de mi persona en los espacios donde se llamaba igual */
export async function updateMyName(db: Db, userId: string, name: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    if (user.name === name) return;
    await tx.user.update({ where: { id: userId }, data: { name, ...auditUpdate(userId) } });
    await renameLinkedPeople(tx, { id: userId, oldName: user.name, newName: name }, userId);
  });
}

/** Mi correo (HU-29): pide la contraseña actual, no puede estar en uso y cierra mis otras sesiones */
export async function changeMyEmail(
  db: Db,
  me: Me,
  { email, currentPassword }: ChangeMyEmailInput,
): Promise<void> {
  await checkPassword(db, me.userId, currentPassword);
  const taken = await db.user.findFirst({
    where: { email, id: { not: me.userId } },
    select: { id: true },
  });
  if (taken) throw new EmailTakenError();
  await db.$transaction([
    db.user.update({ where: { id: me.userId }, data: { email, ...auditUpdate(me.userId) } }),
    closeOtherSessions(db, me),
  ]);
}

/** Mi contraseña (HU-29): pide la actual y cierra mis otras sesiones */
export async function changeMyPassword(
  db: Db,
  me: Me,
  { currentPassword, newPassword }: ChangeMyPasswordInput,
): Promise<void> {
  await checkPassword(db, me.userId, currentPassword);
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction([
    db.user.update({ where: { id: me.userId }, data: { passwordHash, ...auditUpdate(me.userId) } }),
    closeOtherSessions(db, me),
  ]);
}
