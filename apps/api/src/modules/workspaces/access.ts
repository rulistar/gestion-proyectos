import {
  memberPermissionsSchema,
  PERMISSION_TEMPLATES,
  roleHasPermission,
  type MemberAccess,
  type MembershipRole,
  type Permission,
} from '@gestion/shared';
import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../../db/client.js';
import { notDeleted } from '../../db/audit.js';

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() });

/** Acceso de quien pregunta en el workspace de la URL (ADR-0006) */
export type WorkspaceAccess = MemberAccess & { workspaceId: string };

/** Matriz guardada; si no es válida, la de la plantilla de su rol (nunca da más de lo previsto) */
export function parsePermissions(raw: unknown, role: MembershipRole) {
  const parsed = memberPermissionsSchema.safeParse(raw);
  return parsed.success ? parsed.data : PERMISSION_TEMPLATES[role];
}

/**
 * Acceso del usuario al workspace: su membresía activa con su matriz (ADR-0006) o, si es el
 * **Admin del sistema**, ADMIN en cualquier workspace existente (ADR-0002 §5). null = sin acceso.
 */
export async function findAccess(
  db: Db,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceAccess | null> {
  const [membership, person] = await Promise.all([
    db.membership.findFirst({
      where: { workspaceId, userId, ...notDeleted, workspace: notDeleted },
      select: {
        role: true,
        permissions: true,
        projectAccess: { select: { projectId: true } },
        personAccess: { select: { personId: true } },
      },
    }),
    // Su persona del catálogo: "las tareas donde soy Responsable" (ADR-0005)
    db.person.findFirst({ where: { workspaceId, userId }, select: { id: true } }),
  ]);
  const base = { workspaceId, userId, personId: person?.id ?? null };
  if (membership) {
    return {
      ...base,
      role: membership.role,
      permissions: parsePermissions(membership.permissions, membership.role),
      selectedProjectIds: membership.projectAccess.map((access) => access.projectId),
      watchedPersonIds: membership.personAccess.map((access) => access.personId),
    };
  }

  const [user, workspace] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { isSystemAdmin: true } }),
    db.workspace.findFirst({ where: { id: workspaceId, ...notDeleted }, select: { id: true } }),
  ]);
  return user?.isSystemAdmin && workspace
    ? {
        ...base,
        role: 'ADMIN',
        permissions: PERMISSION_TEMPLATES.ADMIN,
        selectedProjectIds: [],
        watchedPersonIds: [],
      }
    : null;
}

/**
 * preHandler para rutas `/workspaces/:workspaceId/...` (RNF-02, ADR-0002 §5). Va después de
 * `requireAuth` y deja el acceso en `request.membership`:
 *
 * - no es miembro (o el ID no es válido) → 404: no revela que el workspace existe
 * - es miembro pero su rol no tiene el permiso → 403
 *
 * Lo que depende de la matriz (ver, crear, modificar, dar de baja) lo decide cada ruta con
 * `visibility.ts` y las reglas de shared (ADR-0006).
 */
function workspaceGuard(permission?: Permission) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const params = workspaceParamsSchema.safeParse(request.params);
    const access =
      params.success && request.auth
        ? await findAccess(request.server.db, params.data.workspaceId, request.auth.userId)
        : null;

    if (!access) {
      return reply.code(404).send({ message: 'Espacio de trabajo no encontrado' });
    }
    if (permission && !roleHasPermission(access.role, permission)) {
      return reply.code(403).send({ message: 'No tienes permiso para esta acción' });
    }
    request.membership = access;
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

/**
 * Exige ser miembro y que el rol tenga el permiso: `{ preHandler: requirePermission('member.manage') }`.
 * Para lo que es solo del Admin (miembros, catálogos, mover, borrar definitivamente).
 */
export function requirePermission(permission: Permission) {
  return workspaceGuard(permission);
}

/** 403 estándar cuando la matriz no permite la acción */
export function forbidden(reply: FastifyReply) {
  return reply.code(403).send({ message: 'No tienes permiso para esta acción' });
}
