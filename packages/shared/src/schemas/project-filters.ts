import { z } from 'zod';
import { projectPrioritySchema, projectStatusSchema, type Project } from './projects.js';

/** Columnas por las que se puede ordenar la lista de contenedores (HU-09) */
export const projectSortKeySchema = z.enum([
  'folio',
  'name',
  'type',
  'sprint',
  'requester',
  'status',
  'priority',
  'percent',
  'pending',
  'endDate',
  'open',
  'overdue',
  'doneThisMonth',
]);
export type ProjectSortKey = z.infer<typeof projectSortKeySchema>;

/**
 * Filtros y orden de la lista (HU-09). Viven en la URL (ADR-0003): un enlace compartido abre la
 * misma vista. Todo es opcional; un valor que no es válido simplemente se ignora (no rompe la página).
 */
export const projectFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  typeId: z.uuid().optional().catch(undefined),
  area: z.string().trim().max(80).optional().catch(undefined),
  classification: z.string().trim().max(80).optional().catch(undefined),
  status: projectStatusSchema.optional().catch(undefined),
  priority: projectPrioritySchema.optional().catch(undefined),
  /** "Fecha de fin hasta" (AAAA-MM-DD) */
  endBy: z.iso.date().optional().catch(undefined),
  /** Terminados y cancelados se ocultan salvo que se pida verlos */
  showClosed: z.boolean().optional().catch(undefined),
  sort: projectSortKeySchema.optional().catch(undefined),
  dir: z.enum(['asc', 'desc']).optional().catch(undefined),
});
export type ProjectFilters = z.infer<typeof projectFiltersSchema>;

/** ¿Hay algún filtro puesto? (para el botón "Limpiar filtros"); sirve también para las tareas (HU-39) */
export function hasActiveFilters(filters: Record<string, unknown>): boolean {
  const { sort: _sort, dir: _dir, ...rest } = filters;
  return Object.values(rest).some((value) => value !== undefined && value !== '');
}

/** Sin acentos ni mayúsculas: "Gómez" encuentra "gomez" */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const CLOSED = new Set(['DONE', 'CANCELLED']);

/**
 * Aplica los filtros (HU-09). El texto busca en nombre, folio, sprint y en las personas del
 * proyecto. Terminados y cancelados se ocultan, salvo con `showClosed` o si se filtra por esos estados.
 */
export function filterProjects(projects: readonly Project[], filters: ProjectFilters): Project[] {
  const words = filters.q ? normalize(filters.q).split(/\s+/).filter(Boolean) : [];
  return projects.filter((project) => {
    if (!filters.showClosed && !filters.status && CLOSED.has(project.status)) return false;
    if (filters.typeId && project.type.id !== filters.typeId) return false;
    if (filters.status && project.status !== filters.status) return false;
    if (filters.priority && project.priority !== filters.priority) return false;
    if (filters.area && project.area !== filters.area) return false;
    if (filters.classification && project.classification !== filters.classification) return false;
    if (filters.endBy && (project.endDate === null || project.endDate > filters.endBy))
      return false;
    if (words.length > 0) {
      const haystack = normalize(
        [
          project.name,
          project.folio,
          project.sprint,
          project.requester?.name,
          project.assignedTo?.name,
          project.projectManager?.name,
          project.consultingManager?.name,
          project.businessPartner?.name,
        ]
          .filter(Boolean)
          .join(' '),
      );
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}

/** Orden lógico de estados y prioridades (no alfabético) */
const STATUS_ORDER = ['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED'];
const PRIORITY_ORDER = ['HIGH', 'MEDIUM', 'LOW'];

function sortValue(project: Project, key: ProjectSortKey): string | number | null {
  switch (key) {
    case 'folio':
      return project.folio;
    case 'name':
      return project.name;
    case 'type':
      return project.type.name;
    case 'sprint':
      return project.sprint;
    case 'requester':
      return project.requester?.name ?? null;
    case 'status':
      return STATUS_ORDER.indexOf(project.status);
    case 'priority':
      return PRIORITY_ORDER.indexOf(project.priority);
    case 'percent':
      return project.progress.percent;
    case 'pending':
      return project.progress.pendingMinutes;
    case 'endDate':
      return project.endDate;
    case 'open':
      return project.progress.openTasks;
    case 'overdue':
      return project.progress.overdueTasks;
    case 'doneThisMonth':
      return project.progress.doneThisMonth;
  }
}

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/**
 * Ordena por el valor que da `valueOf`. Los vacíos (sin folio, sin fecha…) van siempre al final,
 * sea ascendente o descendente; con empate se conserva el orden original. También lo usan las tareas (HU-39).
 */
export function sortByValue<T>(
  items: readonly T[],
  valueOf: (item: T) => string | number | null,
  dir: 'asc' | 'desc' = 'asc',
): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    if (left === null || left === '') return right === null || right === '' ? 0 : 1;
    if (right === null || right === '') return -1;
    const order =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : collator.compare(String(left), String(right));
    return order * sign;
  });
}

/** Ordena por una columna (HU-09); sin columna, el orden original (más recientes primero) */
export function sortProjects(
  projects: readonly Project[],
  key: ProjectSortKey | undefined,
  dir: 'asc' | 'desc' = 'asc',
): Project[] {
  if (!key) return [...projects];
  return sortByValue(projects, (project) => sortValue(project, key), dir);
}
