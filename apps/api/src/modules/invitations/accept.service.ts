import { type InvitationPreview, type MembershipRole } from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, auditUpdate, notDeleted } from '../../db/audit.js';
import { hashPassword } from '../auth/password.js';
import { hashToken } from '../auth/tokens.js';
import { ensureMemberPerson } from '../people/people.service.js';
import { parsePermissions } from '../workspaces/access.js';
import {
  addProjectAccess,
  effectivePermissions,
  selectedInSections,
} from '../workspaces/workspaces.service.js';
import { pending } from './invitations.service.js';

type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];

/** Enlace inexistente, ya usado, revocado o caducado: la respuesta no distingue el motivo */
export class InvalidInvitationError extends Error {}
/** Se intenta crear una cuenta para un correo que ya la tiene */
export class AccountExistsError extends Error {}
/** La sesión es de otra persona (la invitación es para otro correo) */
export class WrongAccountError extends Error {}

/** Invitación pendiente de un workspace activo, buscada por el hash del token */
function findPending(db: Db | Tx, token: string) {
  return db.invitation.findFirst({
    where: { tokenHash: hashToken(token), ...pending(new Date()), workspace: notDeleted },
    select: {
      id: true,
      email: true,
      role: true,
      workspaceId: true,
      workspace: { select: { name: true } },
      // Espacios a los que entra (HU-17c); los que están en la papelera se omiten
      grants: {
        where: { workspace: notDeleted },
        select: {
          workspaceId: true,
          role: true,
          permissions: true,
          selectedProjectIds: true,
          workspace: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

type Grant = {
  workspaceId: string;
  role: MembershipRole;
  permissions: unknown;
  selectedProjectIds: string[];
};

export async function previewInvitation(db: Db, token: string): Promise<InvitationPreview | null> {
  const invitation = await findPending(db, token);
  if (!invitation) return null;
  const account = await db.user.count({ where: { email: invitation.email } });
  return {
    workspaceName: invitation.workspace.name,
    email: invitation.email,
    role: invitation.role,
    workspaces: invitation.grants.map((grant) => ({
      name: grant.workspace.name,
      role: grant.role,
    })),
    hasAccount: account > 0,
  };
}

/**
 * Reclama la invitación dentro de la transacción. El `updateMany` con la condición "sigue
 * pendiente" es atómico: si dos peticiones llegan a la vez con el mismo enlace, solo una lo
 * consigue (un solo uso). Si después algo falla, la transacción deshace el reclamo.
 */
async function claim(tx: Tx, token: string) {
  const invitation = await findPending(tx, token);
  if (!invitation) throw new InvalidInvitationError();

  const now = new Date();
  const { count } = await tx.invitation.updateMany({
    where: { id: invitation.id, ...pending(now) },
    data: { acceptedAt: now },
  });
  if (count === 0) throw new InvalidInvitationError();
  return invitation;
}

/**
 * Entra a cada espacio de la invitación (HU-17c) con su plantilla, su matriz y su lista "Estos…"
 * (sin los contenedores que ya no existan). Si ya era miembro de alguno por otra vía, ese no cambia.
 */
async function joinWorkspaces(tx: Tx, invitation: { id: string; grants: Grant[] }, userId: string) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  for (const grant of invitation.grants) {
    const alreadyMember = await tx.membership.count({
      where: { workspaceId: grant.workspaceId, userId, ...notDeleted },
    });
    if (alreadyMember === 0) {
      const permissions = effectivePermissions(
        grant.role,
        parsePermissions(grant.permissions, grant.role),
      );
      const membership = await tx.membership.create({
        data: {
          workspaceId: grant.workspaceId,
          userId,
          role: grant.role,
          permissions,
          ...auditCreate(userId),
        },
        select: { id: true },
      });
      const { selected } = await selectedInSections(
        tx,
        grant.workspaceId,
        permissions,
        grant.selectedProjectIds,
      );
      await addProjectAccess(tx, membership.id, selected, userId);
    }
    // Su persona en el catálogo del espacio, para asignarle responsabilidades (HU-34)
    await ensureMemberPerson(tx, grant.workspaceId, user, userId);
  }
  await tx.invitation.update({
    where: { id: invitation.id },
    data: { acceptedById: userId, ...auditUpdate(userId) },
  });
}

/** La persona no tenía cuenta: la crea con su nombre y contraseña y entra al workspace */
export async function acceptAsNewUser(
  db: Db,
  token: string,
  { name, password }: { name: string; password: string },
) {
  // Argon2 es lento a propósito: se calcula fuera de la transacción para no alargarla
  const passwordHash = await hashPassword(password);

  return db.$transaction(async (tx) => {
    const invitation = await claim(tx, token);
    if ((await tx.user.count({ where: { email: invitation.email } })) > 0) {
      throw new AccountExistsError();
    }
    const user = await tx.user.create({
      data: { email: invitation.email, name, passwordHash, ...auditCreate(null) },
    });
    await joinWorkspaces(tx, invitation, user.id);
    return { userId: user.id, workspaceId: invitation.workspaceId };
  });
}

/** La persona ya tenía cuenta y su sesión está iniciada: suma el workspace */
export async function acceptAsExistingUser(db: Db, token: string, userId: string) {
  return db.$transaction(async (tx) => {
    const invitation = await claim(tx, token);
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    if (user.email !== invitation.email) throw new WrongAccountError();

    await joinWorkspaces(tx, invitation, userId);
    return { workspaceId: invitation.workspaceId };
  });
}
