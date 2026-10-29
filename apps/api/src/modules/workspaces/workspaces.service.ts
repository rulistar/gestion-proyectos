import {
  PERMISSION_TEMPLATES,
  type CreateWorkspaceRequest,
  type Member,
  type MemberPermissions,
  type MembershipRole,
  type ProjectBehavior,
  type UpdateMemberPermissions,
  type WorkspaceSummary,
} from '@gestion/shared';
import type { Db, Tx } from '../../db/client.js';
import { parsePermissions } from './access.js';
import { auditCreate, auditSoftDelete, auditUpdate, notDeleted } from '../../db/audit.js';
import { displayNames, ensureMemberPerson } from '../people/people.service.js';
import { seedCatalog } from '../project-types/project-types.service.js';

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

/**
 * Miembros activos del workspace, por nombre. Todos los miembros los necesitan (p. ej. para
 * elegir el responsable de una tarea), pero el correo y la matriz de permisos solo los ve quien
 * gestiona miembros.
 */
export async function listMembers(
  db: Db,
  workspaceId: string,
  { withEmail }: { withEmail: boolean },
): Promise<Member[]> {
  const memberships = await db.membership.findMany({
    where: activeMembers(workspaceId),
    select: {
      role: true,
      permissions: true,
      projectAccess: { select: { projectId: true } },
      personAccess: { select: { personId: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });
  // El nombre que se muestra es el de su persona del catálogo, si la tiene (alias, HU-34)
  const names = await displayNames(
    db,
    workspaceId,
    memberships.map(({ user }) => user.id),
  );
  return memberships.map(({ role, permissions, projectAccess, personAccess, user }) => ({
    userId: user.id,
    name: names.get(user.id) ?? user.name,
    email: withEmail ? user.email : null,
    role,
    matrix: withEmail
      ? {
          permissions: parsePermissions(permissions, role),
          selectedProjectIds: projectAccess.map((access) => access.projectId),
          watchedPersonIds: personAccess.map((access) => access.personId),
        }
      : null,
  }));
}

/** El miembro no existe en el espacio (o ya fue quitado) → 404 */
export class MemberNotFoundError extends Error {}
/** La operación dejaría el espacio sin ningún Admin → 409 */
export class LastAdminError extends Error {}
/** Algún contenedor de "Estos…" no es del espacio o está en la papelera → 400 */
export class InvalidSelectedProjectsError extends Error {}
/** Alguna persona cuyo trabajo verá no es del catálogo del espacio → 400 (HU-52) */
export class InvalidWatchedPeopleError extends Error {}

/**
 * Nueva matriz: la plantilla (al cambiar el rol) o la ajustada en la pantalla de permisos. Sin
 * `watchedPersonIds`, las personas cuyo trabajo ve no cambian (HU-52)
 */
type MatrixChange = Omit<UpdateMemberPermissions, 'watchedPersonIds'> & {
  watchedPersonIds?: readonly string[];
};

/**
 * Cambia la plantilla y la matriz (HU-25, HU-17b) o quita a un miembro, en una transacción que
 * comprueba que el espacio no se quede sin Admin. Quitar es un borrado lógico de la membresía:
 * pierde el acceso al instante (cada petición revisa la membresía) y sus tareas conservan su
 * nombre hasta reasignarlas.
 */
async function changeMembership(
  db: Db,
  actorId: string,
  workspaceId: string,
  userId: string,
  change: MatrixChange | { remove: true },
) {
  await db.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { workspaceId, userId, ...notDeleted },
      select: { id: true, role: true, userId: true },
    });
    if (!membership) throw new MemberNotFoundError();

    const losesAdmin =
      membership.role === 'ADMIN' && ('remove' in change || change.role !== 'ADMIN');
    if (losesAdmin) {
      const admins = await tx.membership.count({
        where: { ...activeMembers(workspaceId), role: 'ADMIN' },
      });
      if (admins <= 1) throw new LastAdminError();
    }

    if ('remove' in change) {
      await tx.membership.update({ where: { id: membership.id }, data: auditSoftDelete(actorId) });
      return;
    }

    const permissions = effectivePermissions(change.role, change.permissions);
    const { selected, missing } = await selectedInSections(
      tx,
      workspaceId,
      permissions,
      change.selectedProjectIds,
    );
    if (missing > 0) throw new InvalidSelectedProjectsError();

    await tx.membership.update({
      where: { id: membership.id },
      data: { role: change.role, permissions, ...auditUpdate(actorId) },
    });
    await tx.membershipProjectAccess.deleteMany({ where: { membershipId: membership.id } });
    await addProjectAccess(tx, membership.id, selected, actorId);

    if (change.watchedPersonIds) {
      const watched = await watchedInWorkspace(tx, workspaceId, userId, change.watchedPersonIds);
      await tx.membershipPersonAccess.deleteMany({ where: { membershipId: membership.id } });
      if (watched.length > 0) {
        await tx.membershipPersonAccess.createMany({
          data: watched.map((personId) => ({
            membershipId: membership.id,
            personId,
            createdById: actorId,
          })),
        });
      }
    }
  });
}

/**
 * Personas cuyo trabajo verá (HU-52): deben ser del catálogo del espacio; su propia persona se
 * ignora (lo suyo ya lo ve)
 */
async function watchedInWorkspace(
  tx: Tx,
  workspaceId: string,
  userId: string,
  ids: readonly string[],
): Promise<string[]> {
  const requested = [...new Set(ids)];
  const people = await tx.person.findMany({
    where: { id: { in: requested }, workspaceId },
    select: { id: true, userId: true },
  });
  if (people.length !== requested.length) throw new InvalidWatchedPeopleError();
  return people.filter((person) => person.userId !== userId).map((person) => person.id);
}

/** El Admin puede todo: su matriz es siempre la plantilla (ADR-0006 §2) */
export function effectivePermissions(
  role: MembershipRole,
  permissions: MemberPermissions | undefined,
): MemberPermissions {
  return role === 'ADMIN' || !permissions ? PERMISSION_TEMPLATES[role] : permissions;
}

/**
 * Contenedores de "Estos…" que se guardan: los pedidos que son del espacio, no están en la
 * papelera y pertenecen a una sección que ve "Estos…" (los demás no tendrían efecto). `missing`
 * cuenta los pedidos que no son del espacio o están en la papelera.
 */
export async function selectedInSections(
  tx: Db | Tx,
  workspaceId: string,
  permissions: MemberPermissions,
  ids: readonly string[],
): Promise<{ selected: string[]; missing: number }> {
  const sections = (Object.keys(permissions.sections) as ProjectBehavior[]).filter(
    (behavior) => permissions.sections[behavior].view === 'SELECTED',
  );
  const requested = [...new Set(ids)];
  const projects = await tx.project.findMany({
    where: { id: { in: requested }, workspaceId, ...notDeleted },
    select: { id: true, type: { select: { behavior: true } } },
  });
  return {
    selected: projects
      .filter((project) => sections.includes(project.type.behavior))
      .map((project) => project.id),
    missing: requested.length - projects.length,
  };
}

/** Guarda la lista "Estos…" de una membresía */
export async function addProjectAccess(
  tx: Tx,
  membershipId: string,
  projectIds: readonly string[],
  actorId: string,
) {
  if (projectIds.length === 0) return;
  await tx.membershipProjectAccess.createMany({
    data: projectIds.map((projectId) => ({ membershipId, projectId, createdById: actorId })),
  });
}

/** Cambiar el rol aplica su plantilla: se pierden los ajustes y la lista "Estos…" (ADR-0006 §2) */
export function changeMemberRole(
  db: Db,
  actorId: string,
  workspaceId: string,
  userId: string,
  role: MembershipRole,
) {
  return changeMembership(db, actorId, workspaceId, userId, {
    role,
    permissions: PERMISSION_TEMPLATES[role],
    selectedProjectIds: [],
  });
}

/** Plantilla + matriz ajustada + lista "Estos…" (HU-17b) */
export function changeMemberPermissions(
  db: Db,
  actorId: string,
  workspaceId: string,
  userId: string,
  change: MatrixChange,
) {
  return changeMembership(db, actorId, workspaceId, userId, change);
}

export function removeMember(db: Db, actorId: string, workspaceId: string, userId: string) {
  return changeMembership(db, actorId, workspaceId, userId, { remove: true });
}

/**
 * Cambia el nombre visible del espacio. Es solo una etiqueta: todo (permisos, enlaces, apps
 * externas) se relaciona por el ID, que no cambia.
 */
export async function renameWorkspace(
  db: Db,
  actorId: string,
  workspaceId: string,
  { name }: CreateWorkspaceRequest,
) {
  return db.workspace.update({
    where: { id: workspaceId },
    data: { name, ...auditUpdate(actorId) },
    select: { id: true, name: true },
  });
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
        permissions: PERMISSION_TEMPLATES.ADMIN,
        ...auditCreate(actorId),
      },
    });
    await seedCatalog(tx, workspace.id, actorId);
    const creator = await tx.user.findUniqueOrThrow({
      where: { id: actorId },
      select: { id: true, name: true, email: true },
    });
    await ensureMemberPerson(tx, workspace.id, creator, actorId);
    return { id: workspace.id, name: workspace.name, role: membership.role };
  });
}
