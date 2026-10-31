import type { DetailField } from './detail-fields.js';
import type { ProjectBehavior } from './project-types.js';
import type { ProjectPriority, ProjectStatus } from './projects.js';
import type { TaskStatus } from './tasks.js';

/**
 * Exportar (HU-13): CSV compatible con Excel. Las 16 columnas del prototipo "Gestor de cursos", en
 * su orden y con los nombres de ahora (curso → proyecto, unidad → fase, actividad → tarea,
 * Plataforma → Área), seguidas de las nuevas y de una por cada campo de detalle (decisión del PO,
 * 2026-10-31). Importar (HU-14) aceptará este archivo y los respaldos del prototipo.
 */
export const CSV_BASE_COLUMNS = [
  'Proyecto',
  'Área',
  'Clasificación',
  'Estado',
  'Prioridad',
  'Proyecto inicio',
  'Proyecto fin',
  'Fase',
  'Fase inicio',
  'Fase fin',
  'Tarea',
  'Tipo',
  'Duración (min)',
  'Tarea inicio',
  'Tarea fin',
  'Completada',
  // Nuevas (no estaban en el prototipo)
  'Sección',
  'Tipo de contenedor',
  'Folio',
  'Estado de la tarea',
  'Responsable',
  'Origen',
  'Detalle del origen',
] as const;

export const SECTION_LABELS: Record<ProjectBehavior, string> = {
  WITH_END: 'Proyectos',
  ONGOING: 'Mantenimientos',
  ON_DEMAND: 'Actividades',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  NOT_STARTED: 'No iniciado',
  IN_PROGRESS: 'En curso',
  PAUSED: 'Pausado',
  CANCELLED: 'Cancelado',
  DONE: 'Terminado',
};

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En curso',
  PAUSED: 'Pausada',
  DONE: 'Hecha',
  CANCELLED: 'Cancelada',
};

/** Un valor de campo de detalle como texto: Sí/No, fecha AAAA-MM-DD, número u opción */
export function detailCell(
  field: Pick<DetailField, 'kind'>,
  value: string | number | boolean | undefined,
): string {
  if (value === undefined) return '';
  if (field.kind === 'BOOLEAN') return value === true ? 'Sí' : 'No';
  return String(value);
}

/**
 * Columnas de los campos de detalle: una por nombre (dos tipos con "Severidad" comparten columna).
 * Si un campo de contenedor se llama igual que uno de tarea, el del contenedor lleva "(contenedor)".
 */
export function detailColumns(fields: readonly DetailField[]): {
  task: string[];
  container: string[];
  header: (field: DetailField) => string;
} {
  const unique = (names: string[]) => [...new Set(names)];
  const task = unique(fields.filter((f) => f.taskTypeId).map((f) => f.name));
  const taskNames = new Set(task.map((name) => name.toLowerCase()));
  const header = (field: DetailField) =>
    field.projectTypeId && taskNames.has(field.name.toLowerCase())
      ? `${field.name} (contenedor)`
      : field.name;
  const container = unique(fields.filter((f) => f.projectTypeId).map(header));
  return { task, container, header };
}

/** Una celda: entre comillas si lleva coma, comillas, salto de línea o espacios en las orillas */
function csvCell(value: string): string {
  return /[",\r\n]|^\s|\s$/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Texto CSV con BOM UTF-8 (para que Excel muestre bien los acentos) y fin de línea CRLF. Una celda
 * que empieza con =, +, - o @ (y no es un número) se precede con un apóstrofo: Excel no la ejecuta
 * como fórmula.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const safe = (value: string) =>
    /^[=+\-@]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return `\uFEFF${rows.map((row) => row.map((value) => csvCell(safe(value))).join(',')).join('\r\n')}\r\n`;
}
