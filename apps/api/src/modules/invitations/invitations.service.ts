import {
  INVITATION_TTL_HOURS,
  type CreateInvitationRequest,
  type CreateInvitationResponse,
  type Invitation,
  type MembershipRole,
} from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';
import { generateToken, hashToken } from '../auth/tokens.js';
import { findAccess } from '../workspaces/access.js';
import { effectivePermissions, selectedInSections } from '../workspaces/workspaces.service.js';

/** Lo que se lee de una invitación para mostrarla, con sus espacios (HU-17c) */
const invitationSelect = {
  id: true,
  email: true,
  expiresAt: true,
  grants: {
    select: { role: true, workspace: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
} as const;

type InvitationRow = {
  id: string;
  email: string;
  expiresAt: Date;
  grants: { role: MembershipRole; workspace: { id: string; name: string } }[];
};

/** `workspaceId` = el espacio desde el que se consulta: su rol es el que se muestra */
function toInvitation(row: InvitationRow, workspaceId: string): Invitation {
  const workspaces = row.grants.map(({ role, workspace }) => ({ ...workspace, role }));
  return {
    id: row.id,
    email: row.email,
    role: workspaces.find((w) => w.id === workspaceId)?.role ?? workspaces[0]!.role,
    expiresAt: row.expiresAt.toISOString(),
    workspaces,
  };
}

/** Pendiente = ni aceptada, ni revocada, ni caducada */
export function pending(now: Date) {
  return { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

/** Invitaciones pendientes que incluyen este espacio (aunque se hayan creado desde otro) */
export async function listPendingInvitations(db: Db, workspaceId: string): Promise<Invitation[]> {
  const rows = await db.invitation.findMany({
    where: { grants: { some: { workspaceId } }, ...pending(new Date()) },
    select: invitationSelect,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => toInvitation(row, workspaceId));
}

/** Ya es miembro o ya tiene una invitación pendiente en algún espacio (→ 409) */
export class InvitationConflictError extends Error {}
/** Quien invita no es Admin de alguno de los otros espacios (→ 403) */
export class NotAdminOfWorkspaceError extends Error {}
/** Espacios repetidos o contenedores de "Estos…" que no son del espacio (→ 400) */
export class InvalidInvitationGrantError extends Error {}

/**
 * Crea una invitación a uno o varios espacios (HU-04, HU-17c) y devuelve el token una sola vez
 * (en la BD queda su hash). Quien invita debe ser Admin de cada espacio; la ruta ya comprobó el
 * primero. Cada espacio guarda su plantilla, su matriz y su lista "Estos…".
 */
export async function createInvitation(
  db: Db,
  actorId: string,
  workspaceId: string,
  { email, otherWorkspaces = [], ...first }: CreateInvitationRequest,
): Promise<CreateInvitationResponse> {
  const now = new Date();
  const requested = [{ ...first, workspaceId }, ...otherWorkspaces];
  if (new Set(requested.map((grant) => grant.workspaceId)).size !== requested.length) {
    throw new InvalidInvitationGrantError('Un espacio aparece dos veces en la invitación');
  }

  const grants = [];
  for (const grant of requested) {
    if (grant.workspaceId !== workspaceId) {
      const access = await findAccess(db, grant.workspaceId, actorId);
      if (access?.role !== 'ADMIN') throw new NotAdminOfWorkspaceError();
    }
    const [workspace, isMember, hasPending] = await Promise.all([
      db.workspace.findUniqueOrThrow({ where: { id: grant.workspaceId }, select: { name: true } }),
      db.membership.count({
        where: { workspaceId: grant.workspaceId, ...notDeleted, user: { email } },
      }),
      db.invitation.count({
        where: { email, grants: { some: { workspaceId: grant.workspaceId } }, ...pending(now) },
      }),
    ]);
    if (isMember > 0) {
      throw new InvitationConflictError(`Esa persona ya es miembro de "${workspace.name}"`);
    }
    if (hasPending > 0) {
      throw new InvitationConflictError(
        `Ya hay una invitación pendiente para ese correo en "${workspace.name}"; revócala para generar otra`,
      );
    }
    const permissions = effectivePermissions(grant.role, grant.permissions);
    const { selected, missing } = await selectedInSections(
      db,
      grant.workspaceId,
      permissions,
      grant.selectedProjectIds ?? [],
    );
    if (missing > 0) {
      throw new InvalidInvitationGrantError(
        `Hay contenedores de "Estos…" que no son de "${workspace.name}"`,
      );
    }
    grants.push({
      workspaceId: grant.workspaceId,
      role: grant.role,
      permissions,
      selectedProjectIds: selected,
      createdById: actorId,
    });
  }

  const token = generateToken();
  const row = await db.invitation.create({
    data: {
      workspaceId,
      email,
      role: first.role,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_HOURS * 3_600_000),
      grants: { create: grants },
      ...auditCreate(actorId),
    },
    select: invitationSelect,
  });
  return { invitation: toInvitation(row, workspaceId), token };
}

/**
 * Revoca una invitación pendiente que incluye este espacio (la invitación entera, con todos sus
 * espacios); false si no existe para ese espacio o ya no está pendiente
 */
export async function revokeInvitation(
  db: Db,
  actorId: string,
  workspaceId: string,
  invitationId: string,
): Promise<boolean> {
  const now = new Date();
  const { count } = await db.invitation.updateMany({
    where: { id: invitationId, grants: { some: { workspaceId } }, ...pending(now) },
    data: { revokedAt: now, revokedById: actorId, ...auditUpdate(actorId) },
  });
  return count > 0;
}
