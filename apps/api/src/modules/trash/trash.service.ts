import {
  phaseDescendantIds,
  type ContainerFacts,
  type TaskFacts,
  type TrashItem,
  type TrashKind,
} from '@gestion/shared';
import type { Db, Tx } from '../../db/client.js';
import { auditRestore, notDeleted } from '../../db/audit.js';

/** Lo que está en la papelera; `deletedAt` no es null */
const inTrash = { deletedAt: { not: null } } as const;

/** Sin fase, o con una fase activa: si su fase está en la papelera, se fue con ella (HU-07) */
const phaseActive = { OR: [{ phaseId: null }, { phase: notDeleted }] };

/** Fase de la papelera que se ve sola: su proyecto y su madre están activos */
const phaseShown = { project: notDeleted, OR: [{ parentId: null }, { parent: notDeleted }] };

const deletedBySelect = { deletedAt: true, deletedBy: { select: { name: true } } } as const;

/** Qué elementos de la papelera puede ver y restaurar quien pregunta (ADR-0006 §3) */
export interface TrashFilter {
  project: (facts: ContainerFacts) => boolean;
  /** Recibe el contenedor de la fase */
  phase: (facts: ContainerFacts) => boolean;
  task: (facts: TaskFacts) => boolean;
}

const containerFactsSelect = {
  id: true,
  createdById: true,
  scope: true,
  type: { select: { behavior: true } },
} as const;

/**
 * Lo que se fue con una fase (HU-07): ella, sus subfases y sus tareas con su mismo deletedAt. Lo
 * que ya estaba en la papelera antes tiene otra fecha y se queda ahí.
 */
async function phaseBundle(db: Db | Tx, projectId: string, phaseId: string, deletedAt: Date) {
  const phases = await db.phase.findMany({
    where: { projectId },
    select: { id: true, parentId: true, position: true, deletedAt: true },
  });
  const inside = [...phaseDescendantIds(phases, phaseId)];
  const phaseIds = phases
    .filter((p) => inside.includes(p.id) && p.deletedAt?.getTime() === deletedAt.getTime())
    .map((p) => p.id);
  return { phaseIds, taskWhere: { phaseId: { in: inside }, deletedAt } };
}

/**
 * Papelera del workspace (HU-15), lo más reciente primero. Las tareas de un proyecto o de una fase
 * dados de baja no se listan aparte: se fueron con él y vuelven con él. Sin `filter` (Admin) se
 * ve todo.
 */
export async function listTrash(
  db: Db,
  workspaceId: string,
  filter?: TrashFilter,
): Promise<TrashItem[]> {
  const [allProjects, allPhases, allTasks] = await Promise.all([
    db.project.findMany({
      where: { workspaceId, ...inTrash },
      select: {
        ...containerFactsSelect,
        name: true,
        ...deletedBySelect,
        _count: { select: { tasks: { where: notDeleted } } },
      },
    }),
    db.phase.findMany({
      where: { workspaceId, ...inTrash, ...phaseShown },
      select: {
        id: true,
        name: true,
        projectId: true,
        project: { select: { ...containerFactsSelect, name: true } },
        ...deletedBySelect,
      },
    }),
    db.task.findMany({
      where: { workspaceId, ...inTrash, project: notDeleted, ...phaseActive },
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
    scope: ContainerFacts['scope'];
    type: { behavior: ContainerFacts['behavior'] };
  }) => ({
    id: p.id,
    createdById: p.createdById,
    behavior: p.type.behavior,
    scope: p.scope,
  });
  const projects = filter ? allProjects.filter((p) => filter.project(container(p))) : allProjects;
  const phases = filter ? allPhases.filter((p) => filter.phase(container(p.project))) : allPhases;
  const phaseTaskCounts = await Promise.all(
    phases.map(async (p) => {
      const { taskWhere } = await phaseBundle(db, p.projectId, p.id, p.deletedAt!);
      return db.task.count({ where: taskWhere });
    }),
  );
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
    ...phases.map((p, index) => ({
      kind: 'phase' as const,
      id: p.id,
      name: p.name,
      projectName: p.project.name,
      taskCount: phaseTaskCounts[index]!,
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
  if (kind === 'phase') {
    return db.$transaction(async (tx) => {
      const phase = await tx.phase.findFirst({
        where: { ...trashWhere(workspaceId, id), ...phaseShown },
        select: { projectId: true, deletedAt: true },
      });
      if (!phase) return false;
      // Vuelve lo que se fue con ella, con sus subfases y sus tareas
      const { phaseIds, taskWhere } = await phaseBundle(tx, phase.projectId, id, phase.deletedAt!);
      await tx.task.updateMany({ where: taskWhere, data });
      await tx.phase.updateMany({ where: { id: { in: phaseIds } }, data });
      return true;
    });
  }
  const { count } =
    kind === 'project'
      ? await db.project.updateMany({ where: trashWhere(workspaceId, id), data })
      : await db.task.updateMany({
          where: { ...trashWhere(workspaceId, id), project: notDeleted, ...phaseActive },
          data,
        });
  return count > 0;
}

/**
 * Borrado físico, solo de lo que ya está en la papelera (decisión del PO). Un proyecto se lleva
 * sus fases y tareas; una fase, sus subfases y sus tareas (onDelete: Cascade en la BD). false si
 * no está en la papelera (→ 404).
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
      : kind === 'phase'
        ? await db.phase.deleteMany({ where: { ...trashWhere(workspaceId, id), ...phaseShown } })
        : await db.task.deleteMany({
            where: { ...trashWhere(workspaceId, id), project: notDeleted, ...phaseActive },
          });
  return count > 0;
}
