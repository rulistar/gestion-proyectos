import type { MembershipRole } from '@gestion/shared';
import type { Db } from '../db/client.js';
import { auditCreate } from '../db/audit.js';
import { createSession, SESSION_COOKIE } from '../modules/auth/session.js';

/** Usuario con sesión iniciada, sin pasar por el login (eso ya lo prueba auth.test.ts) */
export async function userWithSession(db: Db, email: string) {
  const user = await db.user.create({ data: { email, name: email, ...auditCreate(null) } });
  const token = await createSession(db, { userId: user.id, idleMinutes: 60 });
  return { user, cookies: { [SESSION_COOKIE]: token } };
}

/** Agrega un usuario a un workspace con el rol indicado */
export async function addMember(db: Db, workspaceId: string, userId: string, role: MembershipRole) {
  await db.membership.create({ data: { workspaceId, userId, role, ...auditCreate(null) } });
}
