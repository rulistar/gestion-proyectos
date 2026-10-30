import {
  emailSchema,
  PASSWORD_RESET_TTL_HOURS,
  passwordSchema,
  type PasswordResetLink,
  type PasswordResetPreview,
} from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditUpdate } from '../../db/audit.js';
import { hashPassword } from '../auth/password.js';
import { generateToken, hashToken } from '../auth/tokens.js';

/** Una cuenta desactivada no puede entrar: primero se reactiva (→ 409) */
export class DisabledAccountError extends Error {}
/** Enlace inexistente, ya usado, caducado o de una cuenta desactivada: no se distingue el motivo */
export class InvalidResetError extends Error {}

/**
 * Genera un enlace para que alguien cree una contraseña nueva (HU-54) y devuelve el token una
 * sola vez. Los enlaces anteriores de esa cuenta que no se usaron dejan de servir.
 * null si la cuenta no existe (→ 404).
 */
export async function createPasswordReset(
  db: Db,
  actorId: string,
  userId: string,
): Promise<PasswordResetLink | null> {
  const user = await db.user.findFirst({
    where: { id: userId, kind: 'HUMAN' },
    select: { status: true },
  });
  if (!user) return null;
  if (user.status !== 'ACTIVE') throw new DisabledAccountError();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_HOURS * 3_600_000);
  await db.$transaction([
    db.passwordReset.deleteMany({ where: { userId, usedAt: null } }),
    db.passwordReset.create({
      data: { userId, tokenHash: hashToken(token), expiresAt, ...auditCreate(actorId) },
    }),
  ]);
  return { token, expiresAt: expiresAt.toISOString() };
}

/** Enlace sin usar, vigente y de una cuenta activa */
function findValid(db: Db, token: string) {
  return db.passwordReset.findFirst({
    where: {
      tokenHash: hashToken(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
      user: { status: 'ACTIVE', kind: 'HUMAN' },
    },
    select: { id: true, user: { select: { id: true, name: true, email: true } } },
  });
}

export async function previewPasswordReset(
  db: Db,
  token: string,
): Promise<PasswordResetPreview | null> {
  const reset = await findValid(db, token);
  return reset && { name: reset.user.name, email: reset.user.email };
}

/**
 * Guarda la contraseña nueva y cierra todas las sesiones de la cuenta; devuelve su ID para
 * iniciar sesión. El `updateMany` con "sin usar" es atómico: el enlace sirve una sola vez.
 */
export async function completePasswordReset(
  db: Db,
  token: string,
  password: string,
): Promise<string> {
  const reset = await findValid(db, token);
  if (!reset) throw new InvalidResetError();
  // Se calcula fuera de la transacción: el hash tarda y no debe retener la conexión
  const passwordHash = await hashPassword(password);
  const userId = reset.user.id;
  await db.$transaction(async (tx) => {
    const claimed = await tx.passwordReset.updateMany({
      where: { id: reset.id, usedAt: null },
      data: { usedAt: new Date(), ...auditUpdate(userId) },
    });
    if (claimed.count === 0) throw new InvalidResetError();
    await tx.user.update({ where: { id: userId }, data: { passwordHash, ...auditUpdate(userId) } });
    await tx.session.deleteMany({ where: { userId } });
  });
  return userId;
}

/** Error esperado del comando de terminal: se muestra tal cual */
export class ResetPasswordCliError extends Error {}

/**
 * Comando `pnpm reset:password` (HU-54): para cuando quien olvida su contraseña es el Admin del
 * sistema y nadie más puede generarle un enlace. Quien lo corre ya tiene acceso a la BD.
 * Cierra todas las sesiones de la cuenta; si estaba desactivada, sigue desactivada.
 */
export async function resetPasswordByEmail(db: Db, email: string, password: string) {
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) throw new ResetPasswordCliError('Correo no válido.');
  const parsedPassword = passwordSchema.safeParse(password);
  if (!parsedPassword.success) {
    throw new ResetPasswordCliError(
      parsedPassword.error.issues[0]?.message ?? 'Contraseña no válida.',
    );
  }
  const user = await db.user.findFirst({
    where: { email: parsedEmail.data, kind: 'HUMAN' },
    select: { id: true, email: true, status: true },
  });
  if (!user)
    throw new ResetPasswordCliError(`No hay ninguna cuenta con el correo ${parsedEmail.data}.`);
  const passwordHash = await hashPassword(parsedPassword.data);
  // updatedById nulo: lo cambia el sistema (ADR-0002, RNF-01)
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash, updatedById: null } }),
    db.session.deleteMany({ where: { userId: user.id } }),
    db.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } }),
  ]);
  return user;
}
