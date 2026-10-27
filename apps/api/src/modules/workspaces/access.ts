import { roleHasPermission, type Permission } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../../db/client.js';
import { notDeleted } from '../../db/audit.js';

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() });

/**
 * Rol del usuario en el workspace: el de su membresía activa o, si es el **Admin del sistema**,
 * ADMIN en cualquier workspace existente (decisión del PO, ADR-0002 §5). null = sin acceso.
 */
async function findAccess(db: Db, workspaceId: string, userId: string) {
  const membership = await db.membership.findFirst({
    where: { workspaceId, userId, ...notDeleted, workspace: notDeleted },
    select: { workspaceId: true, role: true },
  });
  if (membership) return membership;

  const [user, workspace] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { isSystemAdmin: true } }),
    db.workspace.findFirst({ where: { id: workspaceId, ...notDeleted }, select: { id: true } }),
  ]);
  return user?.isSystemAdmin && workspace ? { workspaceId, role: 'ADMIN' as const } : null;
}

/**
 * preHandler para rutas `/workspaces/:workspaceId/...` (RNF-02, ADR-0002 §5). Va después de
 * `requireAuth` y deja la membresía en `request.membership`:
 *
 * - no es miembro (o el ID no es válido) → 404: no revela que el workspace existe
 * - es miembro pero su rol no tiene el permiso → 403
 */
function workspaceGuard(permission?: Permission) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const params = workspaceParamsSchema.safeParse(request.params);
    const membership =
      params.success && request.auth
        ? await findAccess(request.server.db, params.data.workspaceId, request.auth.userId)
        : null;

    if (!membership) {
      return reply.code(404).send({ message: 'Espacio de trabajo no encontrado' });
    }
    if (permission && !roleHasPermission(membership.role, permission)) {
      return reply.code(403).send({ message: 'No tienes permiso para esta acción' });
    }
    request.membership = membership;
  };
}

/**
 * ¿El usuario tiene el permiso en otro workspace? Para operaciones que tocan dos espacios, como
 * mover un proyecto (HU-32): la ruta revisa el origen con requirePermission y el destino con esto.
 * null = no tiene acceso al espacio (→ 404); false = sin permiso (→ 403).
 */
export async function permissionIn(
  db: Db,
  workspaceId: string,
  userId: string,
  permission: Permission,
): Promise<boolean | null> {
  const access = await findAccess(db, workspaceId, userId);
  return access && roleHasPermission(access.role, permission);
}

/** Solo exige ser miembro del workspace, con cualquier rol */
export const requireMembership = workspaceGuard();

/** Exige ser miembro y que el rol tenga el permiso: `{ preHandler: requirePermission('project.create') }` */
export function requirePermission(permission: Permission) {
  return workspaceGuard(permission);
}
