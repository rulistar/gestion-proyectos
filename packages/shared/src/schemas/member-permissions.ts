import { z } from 'zod';
import type { ProjectBehavior } from './project-types.js';
import type { MembershipRole } from './workspaces.js';

/**
 * Matriz de permisos por persona y espacio (ADR-0006). El rol es la plantilla de la que parte;
 * el Admin no usa la matriz: puede todo.
 */

/** Qué contenedores de una sección ve: los que creó, todos o los de una lista ("Estos…") */
export const sectionViewSchema = z.enum(['OWN', 'ALL', 'SELECTED']);
/** Cuáles modifica: ninguno, los que creó o todos los que ve */
export const sectionUpdateSchema = z.enum(['NONE', 'OWN', 'VISIBLE']);
/** Cuáles da de baja y restaura: ninguno, los que creó o los que puede modificar */
export const sectionRemoveSchema = z.enum(['NONE', 'OWN', 'EDITABLE']);

export const sectionPermissionsSchema = z.object({
  view: sectionViewSchema,
  create: z.boolean(),
  update: sectionUpdateSchema,
  remove: sectionRemoveSchema,
});
export type SectionPermissions = z.infer<typeof sectionPermissionsSchema>;

/** Tareas: "las mías" = las que creé o donde soy el Responsable */
export const taskPermissionsSchema = z.object({
  view: z.enum(['MINE', 'VISIBLE']),
  create: z.boolean(),
  update: z.enum(['NONE', 'MINE', 'VISIBLE']),
  remove: z.enum(['NONE', 'MINE', 'EDITABLE']),
});
export type TaskPermissions = z.infer<typeof taskPermissionsSchema>;

export const memberPermissionsSchema = z.object({
  sections: z.object({
    WITH_END: sectionPermissionsSchema,
    ONGOING: sectionPermissionsSchema,
    ON_DEMAND: sectionPermissionsSchema,
  }),
  tasks: taskPermissionsSchema,
});
export type MemberPermissions = z.infer<typeof memberPermissionsSchema>;

function allSections(section: SectionPermissions): MemberPermissions['sections'] {
  return { WITH_END: section, ONGOING: section, ON_DEMAND: section };
}

/**
 * Plantillas (ADR-0006 §2). Miembro es el valor por defecto del PO: ve sus tareas, crea tareas
 * y modifica las suyas, pero no lo que hizo otro usuario.
 */
export const PERMISSION_TEMPLATES: Record<MembershipRole, MemberPermissions> = {
  ADMIN: {
    sections: allSections({ view: 'ALL', create: true, update: 'VISIBLE', remove: 'EDITABLE' }),
    tasks: { view: 'VISIBLE', create: true, update: 'VISIBLE', remove: 'EDITABLE' },
  },
  MEMBER: {
    sections: allSections({ view: 'OWN', create: false, update: 'OWN', remove: 'NONE' }),
    tasks: { view: 'MINE', create: true, update: 'MINE', remove: 'NONE' },
  },
  VIEWER: {
    sections: allSections({ view: 'ALL', create: false, update: 'NONE', remove: 'NONE' }),
    tasks: { view: 'VISIBLE', create: false, update: 'NONE', remove: 'NONE' },
  },
};

/** Quién pregunta, en un espacio: lo que la API carga con la membresía */
export interface MemberAccess {
  userId: string;
  /** Su persona del catálogo del espacio (para "las tareas donde soy Responsable") */
  personId: string | null;
  role: MembershipRole;
  permissions: MemberPermissions;
  /** Contenedores de la lista "Estos…" */
  selectedProjectIds: readonly string[];
  /** Personas cuyo trabajo puede ver, en solo lectura (HU-52) */
  watchedPersonIds: readonly string[];
}

/** Lo que hace falta de un contenedor para decidir */
export interface ContainerFacts {
  id: string;
  createdById: string | null;
  behavior: ProjectBehavior;
}

/** Lo que hace falta de una tarea para decidir */
export interface TaskFacts {
  createdById: string | null;
  responsiblePersonId: string | null;
  project: ContainerFacts;
}

const isAdmin = (access: MemberAccess) => access.role === 'ADMIN';

/** ¿Lo ve por las reglas de su sección? (sin contar el acceso de solo lectura por tener una tarea) */
export function sectionCanView(access: MemberAccess, project: ContainerFacts): boolean {
  if (isAdmin(access)) return true;
  // Lo que uno creó siempre lo ve
  if (project.createdById === access.userId) return true;
  const { view } = access.permissions.sections[project.behavior];
  if (view === 'ALL') return true;
  return view === 'SELECTED' && access.selectedProjectIds.includes(project.id);
}

export function canCreateContainer(access: MemberAccess, behavior: ProjectBehavior): boolean {
  return isAdmin(access) || access.permissions.sections[behavior].create;
}

export function canUpdateContainer(access: MemberAccess, project: ContainerFacts): boolean {
  if (isAdmin(access)) return true;
  const { update } = access.permissions.sections[project.behavior];
  if (update === 'OWN') return project.createdById === access.userId;
  return update === 'VISIBLE' && sectionCanView(access, project);
}

/** Dar de baja y restaurar (HU-15 con ADR-0006) */
export function canRemoveContainer(access: MemberAccess, project: ContainerFacts): boolean {
  if (isAdmin(access)) return true;
  const { remove } = access.permissions.sections[project.behavior];
  if (remove === 'OWN') return project.createdById === access.userId;
  return remove === 'EDITABLE' && canUpdateContainer(access, project);
}

/** "Las mías": las que creé o donde mi persona del catálogo es la Responsable */
export function isMyTask(access: MemberAccess, task: Omit<TaskFacts, 'project'>): boolean {
  return (
    task.createdById === access.userId ||
    (access.personId !== null && task.responsiblePersonId === access.personId)
  );
}

/** ¿Su Responsable es una persona cuyo trabajo puede ver? (HU-52; solo lectura) */
export function isWatchedTask(
  access: MemberAccess,
  task: Pick<TaskFacts, 'responsiblePersonId'>,
): boolean {
  return (
    task.responsiblePersonId !== null && access.watchedPersonIds.includes(task.responsiblePersonId)
  );
}

/** La ve por su matriz: es suya o, si su permiso lo dice, está en un contenedor que ve */
function matrixCanViewTask(access: MemberAccess, task: TaskFacts): boolean {
  if (isMyTask(access, task)) return true;
  return access.permissions.tasks.view === 'VISIBLE' && sectionCanView(access, task.project);
}

export function canViewTask(access: MemberAccess, task: TaskFacts): boolean {
  return isAdmin(access) || matrixCanViewTask(access, task) || isWatchedTask(access, task);
}

/** Ver el trabajo de otra persona (HU-52) no da permiso de modificarlo */
export function canUpdateTask(access: MemberAccess, task: TaskFacts): boolean {
  if (isAdmin(access)) return true;
  const { update } = access.permissions.tasks;
  if (update === 'MINE') return isMyTask(access, task);
  return update === 'VISIBLE' && matrixCanViewTask(access, task);
}

export function canRemoveTask(access: MemberAccess, task: TaskFacts): boolean {
  if (isAdmin(access)) return true;
  const { remove } = access.permissions.tasks;
  if (remove === 'MINE') return isMyTask(access, task);
  return remove === 'EDITABLE' && canUpdateTask(access, task);
}

/**
 * ¿Puede agregar tareas a este contenedor? Tiene que poder crear tareas y ver el contenedor,
 * aunque sea en solo lectura por tener una tarea en él (`hasMyTask`)
 */
export function canCreateTaskIn(
  access: MemberAccess,
  project: ContainerFacts,
  hasMyTask: boolean,
): boolean {
  if (isAdmin(access)) return true;
  return access.permissions.tasks.create && (sectionCanView(access, project) || hasMyTask);
}

/** ¿La matriz es exactamente la de la plantilla? Si no, la pantalla dice "Miembro (ajustado)" */
export function matchesTemplate(role: MembershipRole, permissions: MemberPermissions): boolean {
  if (role === 'ADMIN') return true;
  const template = PERMISSION_TEMPLATES[role];
  const same = <T extends object>(a: T, b: T) =>
    (Object.keys(b) as (keyof T)[]).every((key) => a[key] === b[key]);
  return (
    (['WITH_END', 'ONGOING', 'ON_DEMAND'] as const).every((behavior) =>
      same(permissions.sections[behavior], template.sections[behavior]),
    ) && same(permissions.tasks, template.tasks)
  );
}

/** ¿Usa la papelera? Quien puede dar de baja algo también lo restaura desde ahí (ADR-0006 §3) */
export function canUseTrash(access: MemberAccess): boolean {
  if (isAdmin(access)) return true;
  const { sections, tasks } = access.permissions;
  return (
    tasks.remove !== 'NONE' || Object.values(sections).some((section) => section.remove !== 'NONE')
  );
}

/** Mi acceso en un espacio, como lo recibe la web en el detalle del espacio (HU-17b) */
export const memberAccessSchema = z.object({
  userId: z.uuid(),
  personId: z.uuid().nullable(),
  permissions: memberPermissionsSchema,
  selectedProjectIds: z.array(z.uuid()),
  watchedPersonIds: z.array(z.uuid()),
});
