import { roleHasPermission, type Permission } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { notDeleted } from '../../db/audit.js';

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() });

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
        ? await request.server.db.membership.findFirst({
            where: {
              workspaceId: params.data.workspaceId,
              userId: request.auth.userId,
              ...notDeleted,
              workspace: notDeleted,
            },
            select: { workspaceId: true, role: true },
          })
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

/** Solo exige ser miembro del workspace, con cualquier rol */
export const requireMembership = workspaceGuard();

/** Exige ser miembro y que el rol tenga el permiso: `{ preHandler: requirePermission('project.create') }` */
export function requirePermission(permission: Permission) {
  return workspaceGuard(permission);
}
