import {
  INVITATION_TTL_HOURS,
  type CreateInvitationRequest,
  type CreateInvitationResponse,
  type Invitation,
} from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';
import { generateToken, hashToken } from '../auth/tokens.js';

const invitationSelect = { id: true, email: true, role: true, expiresAt: true } as const;

function toInvitation(row: Omit<Invitation, 'expiresAt'> & { expiresAt: Date }): Invitation {
  return { ...row, expiresAt: row.expiresAt.toISOString() };
}

/** Pendiente = ni aceptada, ni revocada, ni caducada */
export function pending(now: Date) {
  return { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

export async function listPendingInvitations(db: Db, workspaceId: string): Promise<Invitation[]> {
  const rows = await db.invitation.findMany({
    where: { workspaceId, ...pending(new Date()) },
    select: invitationSelect,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toInvitation);
}

export class InvitationConflictError extends Error {}

/**
 * Crea una invitación y devuelve el token una sola vez (en la BD queda su hash).
 * Falla con InvitationConflictError si el correo ya es miembro o ya tiene una invitación pendiente.
 */
export async function createInvitation(
  db: Db,
  actorId: string,
  workspaceId: string,
  { email, role }: CreateInvitationRequest,
): Promise<CreateInvitationResponse> {
  const now = new Date();
  const [isMember, hasPending] = await Promise.all([
    db.membership.count({ where: { workspaceId, ...notDeleted, user: { email } } }),
    db.invitation.count({ where: { workspaceId, email, ...pending(now) } }),
  ]);
  if (isMember > 0) {
    throw new InvitationConflictError('Esa persona ya es miembro del espacio de trabajo');
  }
  if (hasPending > 0) {
    throw new InvitationConflictError(
      'Ya hay una invitación pendiente para ese correo; revócala para generar otra',
    );
  }

  const token = generateToken();
  const row = await db.invitation.create({
    data: {
      workspaceId,
      email,
      role,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_HOURS * 3_600_000),
      ...auditCreate(actorId),
    },
    select: invitationSelect,
  });
  return { invitation: toInvitation(row), token };
}

/** Revoca una invitación pendiente; false si no existe en ese workspace o ya no está pendiente */
export async function revokeInvitation(
  db: Db,
  actorId: string,
  workspaceId: string,
  invitationId: string,
): Promise<boolean> {
  const now = new Date();
  const { count } = await db.invitation.updateMany({
    where: { id: invitationId, workspaceId, ...pending(now) },
    data: { revokedAt: now, revokedById: actorId, ...auditUpdate(actorId) },
  });
  return count > 0;
}
