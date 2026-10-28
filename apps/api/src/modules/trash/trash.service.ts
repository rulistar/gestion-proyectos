import type { ContainerFacts, TaskFacts, TrashItem, TrashKind } from '@gestion/shared';
import type { Db } from '../../db/client.js';
import { auditRestore, notDeleted } from '../../db/audit.js';

/** Lo que está en la papelera; `deletedAt` no es null */
const inTrash = { deletedAt: { not: null } } as const;

const deletedBySelect = { deletedAt: true, deletedBy: { select: { name: true } } } as const;

/** Qué elementos de la papelera puede ver y restaurar quien pregunta (ADR-0006 §3) */
export interface TrashFilter {
  project: (facts: ContainerFacts) => boolean;
  task: (facts: TaskFacts) => boolean;
}

const containerFactsSelect = {
  id: true,
  createdById: true,
  type: { select: { behavior: true } },
} as const;

/**
 * Papelera del workspace (HU-15), lo más reciente primero. Las tareas de un proyecto dado de baja
 * no se listan aparte: se fueron con él y vuelven con él. Sin `filter` (Admin) se ve todo.
 */
export async function listTrash(
  db: Db,
  workspaceId: string,
  filter?: TrashFilter,
): Promise<TrashItem[]> {
  const [allProjects, allTasks] = await Promise.all([
    db.project.findMany({
      where: { workspaceId, ...inTrash },
      select: {
        ...containerFactsSelect,
        name: true,
        ...deletedBySelect,
        _count: { select: { tasks: { where: notDeleted } } },
      },
    }),
    db.task.findMany({
      where: { workspaceId, ...inTrash, project: notDeleted },
      select: {
        id: true,
        title: true,
        createdById: true,
        responsiblePersonId: true,
        project: { select: { ...containerFactsSelect, name: true } },
        ...deletedBySelect,
      },
    }),
  ]);
  const container = (p: {
    id: string;
    createdById: string | null;
    type: { behavior: ContainerFacts['behavior'] };
  }) => ({
    id: p.id,
    createdById: p.createdById,
    behavior: p.type.behavior,
  });
  const projects = filter ? allProjects.filter((p) => filter.project(container(p))) : allProjects;
  const tasks = filter
    ? allTasks.filter((t) =>
        filter.task({
          createdById: t.createdById,
          responsiblePersonId: t.responsiblePersonId,
          project: container(t.project),
        }),
      )
    : allTasks;

  const items: TrashItem[] = [
    ...projects.map((p) => ({
      kind: 'project' as const,
      id: p.id,
      name: p.name,
      projectName: null,
      taskCount: p._count.tasks,
      deletedAt: p.deletedAt!.toISOString(),
      deletedByName: p.deletedBy?.name ?? null,
    })),
    ...tasks.map((t) => ({
      kind: 'task' as const,
      id: t.id,
      name: t.title,
      projectName: t.project.name,
      taskCount: 0,
      deletedAt: t.deletedAt!.toISOString(),
      deletedByName: t.deletedBy?.name ?? null,
    })),
  ];
  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** Filtro de un elemento de la papelera de ese workspace */
function trashWhere(workspaceId: string, id: string) {
  return { id, workspaceId, ...inTrash };
}

/** Saca el elemento de la papelera; false si no está en la papelera de ese workspace (→ 404) */
export async function restoreFromTrash(
  db: Db,
  actorId: string,
  workspaceId: string,
  kind: TrashKind,
  id: string,
): Promise<boolean> {
  const data = auditRestore(actorId);
  const { count } =
    kind === 'project'
      ? await db.project.updateMany({ where: trashWhere(workspaceId, id), data })
      : await db.task.updateMany({
          where: { ...trashWhere(workspaceId, id), project: notDeleted },
          data,
        });
  return count > 0;
}

/**
 * Borrado físico, solo de lo que ya está en la papelera (decisión del PO). Un proyecto se lleva
 * sus tareas (onDelete: Cascade en la BD). false si no está en la papelera (→ 404).
 */
export async function purgeFromTrash(
  db: Db,
  workspaceId: string,
  kind: TrashKind,
  id: string,
): Promise<boolean> {
  const { count } =
    kind === 'project'
      ? await db.project.deleteMany({ where: trashWhere(workspaceId, id) })
      : await db.task.deleteMany({
          where: { ...trashWhere(workspaceId, id), project: notDeleted },
        });
  return count > 0;
}
