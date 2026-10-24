import type { CreateWorkspaceRequest, WorkspaceSummary } from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditCreate, notDeleted } from '../../db/audit.js';

/** Workspaces de los que el usuario es miembro activo (sin los que están en la papelera) */
export async function listWorkspacesForUser(db: Db, userId: string): Promise<WorkspaceSummary[]> {
  const memberships = await db.membership.findMany({
    where: { userId, ...notDeleted, workspace: notDeleted },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
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
