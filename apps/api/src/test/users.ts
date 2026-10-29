import { PERMISSION_TEMPLATES, type MemberPermissions, type MembershipRole } from '@gestion/shared';
import type { Db } from '../db/client.js';
import { auditCreate } from '../db/audit.js';
import { createSession, SESSION_COOKIE } from '../modules/auth/session.js';

/** Usuario con sesión iniciada, sin pasar por el login (eso ya lo prueba auth.test.ts) */
export async function userWithSession(db: Db, email: string) {
  const user = await db.user.create({ data: { email, name: email, ...auditCreate(null) } });
  const token = await createSession(db, { userId: user.id, idleMinutes: 60 });
  return { user, cookies: { [SESSION_COOKIE]: token } };
}

/**
 * Matriz "como antes de ADR-0006" (§5): la que la migración dio a los miembros existentes. Las
 * pruebas anteriores a los permisos por persona la usan para seguir describiendo lo mismo.
 */
export const LEGACY_PERMISSIONS: Record<MembershipRole, MemberPermissions> = {
  ADMIN: PERMISSION_TEMPLATES.ADMIN,
  MEMBER: {
    sections: {
      WITH_END: { view: 'ALL', create: true, update: 'VISIBLE', remove: 'NONE' },
      ONGOING: { view: 'ALL', create: true, update: 'VISIBLE', remove: 'NONE' },
      ON_DEMAND: { view: 'ALL', create: true, update: 'VISIBLE', remove: 'NONE' },
    },
    tasks: { view: 'VISIBLE', create: true, update: 'VISIBLE', remove: 'EDITABLE' },
    workOnly: false,
  },
  VIEWER: PERMISSION_TEMPLATES.VIEWER,
};

/** Agrega un usuario a un workspace con el rol y la matriz indicados */
export async function addMember(
  db: Db,
  workspaceId: string,
  userId: string,
  role: MembershipRole,
  permissions: MemberPermissions = LEGACY_PERMISSIONS[role],
) {
  return db.membership.create({
    data: { workspaceId, userId, role, permissions, ...auditCreate(null) },
  });
}
