import type { CreateWorkspaceRequest, Member, WorkspaceSummary } from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, notDeleted } from '../../db/audit.js';

/**
 * Workspaces que el usuario puede abrir (sin los que están en la papelera): aquellos de los que
 * es miembro activo. El Admin del sistema ve **todos**, como Admin (decisión del PO, ADR-0002 §5).
 */
export async function listWorkspacesForUser(db: Db, userId: string): Promise<WorkspaceSummary[]> {
  const [user, memberships] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { isSystemAdmin: true } }),
    db.membership.findMany({
      where: { userId, ...notDeleted, workspace: notDeleted },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const mine = memberships.map((m) => ({ ...m.workspace, role: m.role }));
  if (!user.isSystemAdmin) return mine;

  const others = await db.workspace.findMany({
    where: { ...notDeleted, id: { notIn: mine.map((w) => w.id) } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return [...mine, ...others.map((w) => ({ ...w, role: 'ADMIN' as const }))];
}

/** Membresías vigentes de usuarios activos (los desactivados no cuentan como miembros) */
function activeMembers(workspaceId: string) {
  return { workspaceId, ...notDeleted, user: { status: 'ACTIVE' as const } };
}

/** Miembros activos del workspace, por nombre */
export async function listMembers(db: Db, workspaceId: string): Promise<Member[]> {
  const memberships = await db.membership.findMany({
    where: activeMembers(workspaceId),
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: 'asc' } },
  });
  return memberships.map(({ role, user }) => ({
    userId: user.id,
    name: user.name,
    email: user.email,
    role,
  }));
}

/** ¿Es un miembro activo del workspace? (p. ej. para poder ser responsable de una tarea) */
export async function isActiveMember(db: Db, workspaceId: string, userId: string) {
  const count = await db.membership.count({ where: { ...activeMembers(workspaceId), userId } });
  return count > 0;
}

/** Crea un workspace y deja a quien lo crea como su Admin, en una sola transacción (HU-03) */
export async function createWorkspace(
  db: Db,
  actorId: string,
  { name }: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name, ...auditCreate(actorId) },
    });
    const membership = await tx.membership.create({
      data: {
        workspaceId: workspace.id,
        userId: actorId,
        role: 'ADMIN',
        ...auditCreate(actorId),
      },
    });
    return { id: workspace.id, name: workspace.name, role: membership.role };
  });
}
