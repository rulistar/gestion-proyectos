import type { ProjectBehavior } from '@gestion/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { WorkspaceAccess } from './access.js';

/**
 * Filtro de visibilidad único (ADR-0006 §3): condiciones de Prisma de "contenedores que ve" y
 * "tareas que ve". Toda consulta de proyectos o tareas las usa, y reproducen las reglas puras de
 * shared (`sectionCanView`, `canViewTask`), que deciden caso por caso al modificar.
 */

const BEHAVIORS: readonly ProjectBehavior[] = ['WITH_END', 'ONGOING', 'ON_DEMAND'];

/** "Las mías": las que creé o donde mi persona del catálogo es la Responsable */
export function myTasksWhere(access: WorkspaceAccess): Prisma.TaskWhereInput {
  const mine: Prisma.TaskWhereInput[] = [{ createdById: access.userId }];
  if (access.personId) mine.push({ responsiblePersonId: access.personId });
  return { OR: mine };
}

/** Las de las personas cuyo trabajo puede ver (HU-52): donde son Responsables */
function watchedTasksWhere(access: WorkspaceAccess): Prisma.TaskWhereInput[] {
  return access.watchedPersonIds.length > 0
    ? [{ responsiblePersonId: { in: [...access.watchedPersonIds] } }]
    : [];
}

/** Contenedores que ve por las reglas de su sección (sin el acceso por tener una tarea) */
export function sectionVisibleWhere(access: WorkspaceAccess): Prisma.ProjectWhereInput {
  if (access.role === 'ADMIN') return {};
  const bySection = BEHAVIORS.map((behavior): Prisma.ProjectWhereInput => {
    const { view } = access.permissions.sections[behavior];
    const inSection = { type: { behavior } };
    if (view === 'ALL') return inSection;
    // Lo que uno creó siempre lo ve
    const own: Prisma.ProjectWhereInput[] = [{ createdById: access.userId }];
    if (view === 'SELECTED') own.push({ id: { in: [...access.selectedProjectIds] } });
    return { ...inSection, OR: own };
  });
  return { OR: bySection };
}

/**
 * Contenedores que ve: los de su sección y, en solo lectura, aquellos donde tiene una tarea suya
 * o de una persona cuyo trabajo puede ver (para que vea el contexto de la tarea, ADR-0006 §1, HU-52)
 */
export function projectVisibleWhere(access: WorkspaceAccess): Prisma.ProjectWhereInput {
  if (access.role === 'ADMIN') return {};
  return {
    OR: [
      sectionVisibleWhere(access),
      {
        tasks: {
          some: { deletedAt: null, OR: [myTasksWhere(access), ...watchedTasksWhere(access)] },
        },
      },
    ],
  };
}

/**
 * Tareas que ve: las suyas, las de las personas cuyo trabajo puede ver (HU-52) y, si su permiso
 * lo dice, las de los contenedores que ve
 */
export function taskVisibleWhere(access: WorkspaceAccess): Prisma.TaskWhereInput {
  if (access.role === 'ADMIN') return {};
  const visible = [myTasksWhere(access), ...watchedTasksWhere(access)];
  if (access.permissions.tasks.view === 'VISIBLE') {
    visible.push({ project: sectionVisibleWhere(access) });
  }
  return { OR: visible };
}
