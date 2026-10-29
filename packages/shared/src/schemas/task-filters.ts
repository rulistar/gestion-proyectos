import { z } from 'zod';
import { normalize, sortByValue } from './project-filters.js';
import { projectBehaviorSchema, projectTypeRefSchema } from './project-types.js';
import { projectScopeSchema } from './projects.js';
import { taskSchema, taskStatusSchema } from './tasks.js';

/** Una tarea del espacio con su contenedor (HU-39, vista "Tareas") */
export const workspaceTaskSchema = taskSchema.extend({
  project: z.object({
    id: z.uuid(),
    name: z.string(),
    folio: z.string().nullable(),
    createdById: z.uuid().nullable(),
    scope: projectScopeSchema,
    type: projectTypeRefSchema,
  }),
});
export type WorkspaceTask = z.infer<typeof workspaceTaskSchema>;

/** Respuesta de GET /workspaces/:workspaceId/tasks */
export const workspaceTaskListSchema = z.array(workspaceTaskSchema);

/** Columnas por las que se puede ordenar la vista de tareas */
export const taskSortKeySchema = z.enum([
  'title',
  'project',
  'type',
  'responsible',
  'status',
  'endDate',
]);
export type TaskSortKey = z.infer<typeof taskSortKeySchema>;

/** Valor del filtro de responsable para las tareas sin nadie asignado */
export const NO_RESPONSIBLE = 'none';
/** Valor del filtro de origen para las tareas sin origen (HU-47) */
export const NO_ORIGIN = 'none';

/**
 * Filtros y orden de la vista de tareas (HU-39). Igual que los de proyectos (HU-09): viven en la
 * URL y un valor inválido se ignora. "Fin hasta" aquí es la fecha de fin de la tarea.
 */
export const taskFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  /** Sección: Proyectos, Mantenimientos o Actividades */
  behavior: projectBehaviorSchema.optional().catch(undefined),
  projectId: z.uuid().optional().catch(undefined),
  typeId: z.uuid().optional().catch(undefined),
  /** ID de la persona, o "none" para las que no tienen responsable */
  responsibleId: z
    .union([z.uuid(), z.literal(NO_RESPONSIBLE)])
    .optional()
    .catch(undefined),
  status: taskStatusSchema.optional().catch(undefined),
  /** ID del origen (HU-47), o "none" para las que no tienen */
  originId: z
    .union([z.uuid(), z.literal(NO_ORIGIN)])
    .optional()
    .catch(undefined),
  endBy: z.iso.date().optional().catch(undefined),
  /** Solo las abiertas con fin anterior a hoy */
  overdue: z.boolean().optional().catch(undefined),
  /** Hechas y canceladas se ocultan salvo que se pida verlas */
  showClosed: z.boolean().optional().catch(undefined),
  sort: taskSortKeySchema.optional().catch(undefined),
  dir: z.enum(['asc', 'desc']).optional().catch(undefined),
});
export type TaskFilters = z.infer<typeof taskFiltersSchema>;

const CLOSED = new Set(['DONE', 'CANCELLED']);

/**
 * Aplica los filtros (HU-39). El texto busca en el título, el tipo, el responsable, el nombre o
 * folio del contenedor y el origen con su detalle (HU-47). `today` (AAAA-MM-DD) es la fecha local del usuario, para "vencidas".
 */
export function filterTasks(
  tasks: readonly WorkspaceTask[],
  filters: TaskFilters,
  today: string,
): WorkspaceTask[] {
  const words = filters.q ? normalize(filters.q).split(/\s+/).filter(Boolean) : [];
  return tasks.filter((task) => {
    const closed = CLOSED.has(task.status);
    if (!filters.showClosed && !filters.status && closed) return false;
    if (filters.behavior && task.project.type.behavior !== filters.behavior) return false;
    if (filters.projectId && task.project.id !== filters.projectId) return false;
    if (filters.typeId && task.type.id !== filters.typeId) return false;
    if (filters.responsibleId) {
      const responsibleId = task.responsible?.id ?? NO_RESPONSIBLE;
      if (responsibleId !== filters.responsibleId) return false;
    }
    if (filters.status && task.status !== filters.status) return false;
    if (filters.originId && (task.origin?.id ?? NO_ORIGIN) !== filters.originId) return false;
    if (filters.endBy && (task.endDate === null || task.endDate > filters.endBy)) return false;
    if (filters.overdue && (closed || task.endDate === null || task.endDate >= today)) return false;
    if (words.length > 0) {
      const haystack = normalize(
        [
          task.title,
          task.type.name,
          task.responsible?.name,
          task.project.name,
          task.project.folio,
          task.origin?.name,
          task.originDetail,
        ]
          .filter(Boolean)
          .join(' '),
      );
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}

/** Orden lógico de los estados (el del tablero) */
const STATUS_ORDER = taskStatusSchema.options;

function sortValue(task: WorkspaceTask, key: TaskSortKey): string | number | null {
  switch (key) {
    case 'title':
      return task.title;
    case 'project':
      return task.project.folio ?? task.project.name;
    case 'type':
      return task.type.name;
    case 'responsible':
      return task.responsible?.name ?? null;
    case 'status':
      return STATUS_ORDER.indexOf(task.status);
    case 'endDate':
      return task.endDate;
  }
}

/**
 * Ordena por una columna (HU-39). Sin columna: las de atención inmediata (Fast track) primero y
 * luego el orden de la API (por fecha de fin, sin fecha al final).
 */
export function sortTasks(
  tasks: readonly WorkspaceTask[],
  key: TaskSortKey | undefined,
  dir: 'asc' | 'desc' = 'asc',
): WorkspaceTask[] {
  if (!key) return [...tasks].sort((a, b) => Number(b.type.expedited) - Number(a.type.expedited));
  return sortByValue(tasks, (task) => sortValue(task, key), dir);
}
