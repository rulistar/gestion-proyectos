import { z } from 'zod';
import { CSV_BASE_COLUMNS } from './export.js';
import { normalize } from './project-filters.js';
import type { ProjectBehavior } from './project-types.js';
import type { ProjectPriority, ProjectStatus } from './projects.js';
import type { TaskStatus } from './tasks.js';

/**
 * Cargar información (HU-14). El archivo (JSON de Exportar, CSV de Exportar o respaldo del
 * prototipo "Gestor de cursos") se convierte primero a este modelo común; la API lo compara con el
 * espacio, muestra el resumen y, al confirmar, lo aplica (solo Actualizar: nunca borra).
 */

/** Cuerpo de POST .../import/preview y .../import/apply: el texto del archivo */
export const importRequestSchema = z.object({
  fileName: z.string().max(200),
  // 5 MB de texto alcanzan para miles de tareas; la ruta limita el cuerpo
  content: z
    .string()
    .min(1, 'El archivo está vacío')
    .max(5_000_000, 'El archivo es demasiado grande'),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

export interface ImportTask {
  title: string;
  typeName: string | null;
  /** Ruta de la fase: ["Módulo 101", "Tema 1"]; vacía = suelta */
  phasePath: string[];
  status: TaskStatus | null;
  estimatedMinutes: number | null;
  startDate: string | null;
  endDate: string | null;
  responsibleName: string | null;
  originName: string | null;
  originDetail: string | null;
  /** Campos de detalle por nombre */
  details: Record<string, string>;
}

export interface ImportContainer {
  name: string;
  folio: string | null;
  typeName: string | null;
  behavior: ProjectBehavior | null;
  area: string | null;
  classification: string | null;
  status: ProjectStatus | null;
  priority: ProjectPriority | null;
  startDate: string | null;
  endDate: string | null;
  details: Record<string, string>;
  tasks: ImportTask[];
}

export interface ImportData {
  /** "JSON de Exportar", "Excel (CSV)" o "Respaldo del prototipo" */
  source: string;
  containers: ImportContainer[];
  /** Filas o datos que no se pudieron leer */
  warnings: string[];
}

/** Lo que verá el Admin antes de confirmar */
export const importPreviewSchema = z.object({
  source: z.string(),
  containers: z.object({ created: z.number().int(), updated: z.number().int() }),
  tasks: z.object({ created: z.number().int(), updated: z.number().int() }),
  /** Lo que se creará en los catálogos (decisión del PO: se crean y se avisa) */
  newCatalog: z.object({
    projectTypes: z.array(z.string()),
    taskTypes: z.array(z.string()),
    origins: z.array(z.string()),
    people: z.array(z.string()),
    phases: z.number().int(),
  }),
  /** Contenedores con lo que les pasará, para revisar */
  items: z.array(
    z.object({
      name: z.string(),
      action: z.enum(['create', 'update']),
      newTasks: z.number().int(),
      updatedTasks: z.number().int(),
    }),
  ),
  warnings: z.array(z.string()),
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;

// --- CSV ---

/**
 * Lee un CSV (RFC 4180): comas, campos entre comillas con comas, comillas dobles ("") y saltos de
 * línea, fin de línea CRLF o LF y BOM al inicio. Excel en español a veces guarda con punto y coma:
 * se detecta en el encabezado.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.slice(0, source.search(/\r?\n|$/));
  const separator =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Sin renglones vacíos (el último salto de línea, o renglones en blanco de Excel)
  return rows.filter((r) => r.some((value) => value.trim() !== ''));
}

// --- Fechas ---

/**
 * Fecha a AAAA-MM-DD (ADR-0002, reglas del prototipo): AAAA-MM-DD, D/M/AAAA o D-M-AA (las ambiguas
 * se leen como día/mes/año) y los números de serie de Excel (45962 = 2025-11-01). null si no es fecha.
 */
export function normalizeDate(value: string): string | null {
  const text = value.trim().replace(/^'/, '');
  if (text === '') return null;
  const valid = (y: number, m: number, d: number) => {
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
      ? date.toISOString().slice(0, 10)
      : null;
  };
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  if (match) return valid(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (match) {
    const year = match[3]!.length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return valid(year, Number(match[2]), Number(match[1]));
  }
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    // Excel cuenta días desde el 30 de diciembre de 1899
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(text)) * 86_400_000);
    return date.toISOString().slice(0, 10);
  }
  return null;
}

// --- Etiquetas en español (las de Exportar y las del prototipo) o identificadores internos ---

function lookup<T extends string>(table: Record<string, T>, value: string): T | null {
  const key = normalize(value.trim());
  if (key === '') return null;
  return (
    table[key] ?? (Object.values(table).includes(value.trim() as T) ? (value.trim() as T) : null)
  );
}

const PROJECT_STATUS: Record<string, ProjectStatus> = {
  'no iniciado': 'NOT_STARTED',
  'sin iniciar': 'NOT_STARTED',
  pendiente: 'NOT_STARTED',
  'en curso': 'IN_PROGRESS',
  'en progreso': 'IN_PROGRESS',
  pausado: 'PAUSED',
  'en pausa': 'PAUSED',
  cancelado: 'CANCELLED',
  terminado: 'DONE',
  completado: 'DONE',
  concluido: 'DONE',
};
const TASK_STATUS: Record<string, TaskStatus> = {
  pendiente: 'PENDING',
  'en curso': 'IN_PROGRESS',
  'en progreso': 'IN_PROGRESS',
  pausada: 'PAUSED',
  hecha: 'DONE',
  terminada: 'DONE',
  completada: 'DONE',
  cancelada: 'CANCELLED',
};
const PRIORITY: Record<string, ProjectPriority> = { alta: 'HIGH', media: 'MEDIUM', baja: 'LOW' };
const SECTION: Record<string, ProjectBehavior> = {
  proyectos: 'WITH_END',
  proyecto: 'WITH_END',
  mantenimientos: 'ONGOING',
  mantenimiento: 'ONGOING',
  actividades: 'ON_DEMAND',
  actividad: 'ON_DEMAND',
};
const YES = new Set(['si', 'sí', 'true', 'verdadero', '1', 'x']);

const text = (value: string | undefined) => {
  const trimmed = (value ?? '').trim().replace(/^'(?=[=+\-@])/, '');
  return trimmed === '' ? null : trimmed;
};

// --- CSV → modelo común ---

/** Columnas del prototipo → las de ahora (curso → proyecto, unidad → fase, actividad → tarea) */
const PROTOTYPE_ALIASES: Record<string, string> = {
  curso: 'Proyecto',
  plataforma: 'Área',
  'curso inicio': 'Proyecto inicio',
  'curso fin': 'Proyecto fin',
  unidad: 'Fase',
  'unidad inicio': 'Fase inicio',
  'unidad fin': 'Fase fin',
  actividad: 'Tarea',
  'actividad inicio': 'Tarea inicio',
  'actividad fin': 'Tarea fin',
};

/** Columnas que no son campos de detalle */
const KNOWN = new Set([...CSV_BASE_COLUMNS].map((column) => normalize(column)));

export function csvToImport(textContent: string): ImportData {
  const rows = parseCsv(textContent);
  const warnings: string[] = [];
  if (rows.length < 2)
    return { source: 'Excel (CSV)', containers: [], warnings: ['El archivo no tiene filas'] };
  let prototype = false;
  const header = rows[0]!.map((raw) => {
    const name = raw.trim();
    const alias = PROTOTYPE_ALIASES[normalize(name)];
    if (alias) prototype = true;
    return alias ?? name;
  });
  const index = new Map(header.map((name, i) => [normalize(name), i]));
  if (!index.has(normalize('Proyecto'))) {
    return {
      source: 'Excel (CSV)',
      containers: [],
      warnings: ['No se encontró la columna "Proyecto" (o "Curso"): ¿es un archivo de Exportar?'],
    };
  }
  const get = (row: string[], column: string) => {
    const i = index.get(normalize(column));
    return i === undefined ? undefined : row[i];
  };
  const date = (row: string[], column: string, line: number) => {
    const raw = text(get(row, column));
    if (!raw) return null;
    const parsed = normalizeDate(raw);
    if (!parsed) warnings.push(`Fila ${line}: "${raw}" no es una fecha válida (${column})`);
    return parsed;
  };
  // Campos de detalle: las columnas que no son conocidas; "(contenedor)" = del contenedor
  const detailColumns = header
    .map((name, i) => ({ name, i }))
    .filter(({ name }) => name !== '' && !KNOWN.has(normalize(name)));

  const containers = new Map<string, ImportContainer>();
  rows.slice(1).forEach((row, offset) => {
    const line = offset + 2;
    const name = text(get(row, 'Proyecto'));
    if (!name) {
      warnings.push(`Fila ${line}: sin nombre de proyecto, se omite`);
      return;
    }
    const folio = text(get(row, 'Folio'));
    const key = normalize(folio ?? `nombre:${name}`);
    let container = containers.get(key);
    if (!container) {
      container = {
        name,
        folio,
        typeName: text(get(row, 'Tipo de contenedor')),
        behavior: lookup(SECTION, get(row, 'Sección') ?? ''),
        area: text(get(row, 'Área')),
        classification: text(get(row, 'Clasificación')),
        status: lookup(PROJECT_STATUS, get(row, 'Estado') ?? ''),
        priority: lookup(PRIORITY, get(row, 'Prioridad') ?? ''),
        startDate: date(row, 'Proyecto inicio', line),
        endDate: date(row, 'Proyecto fin', line),
        details: {},
        tasks: [],
      };
      for (const { name: column, i } of detailColumns) {
        const value = text(row[i]);
        if (value && column.endsWith(' (contenedor)')) {
          container.details[column.replace(/ \(contenedor\)$/, '')] = value;
        }
      }
      containers.set(key, container);
    }
    const title = text(get(row, 'Tarea'));
    if (!title) return; // Contenedor sin tareas
    const completed = text(get(row, 'Completada'));
    const taskStatus =
      lookup(TASK_STATUS, get(row, 'Estado de la tarea') ?? '') ??
      (completed ? (YES.has(normalize(completed)) ? 'DONE' : 'PENDING') : null);
    const minutes = text(get(row, 'Duración (min)'));
    const minutesValue = minutes ? Number(minutes.replace(',', '.')) : null;
    if (minutes && !Number.isFinite(minutesValue)) {
      warnings.push(`Fila ${line}: "${minutes}" no es un número de minutos`);
    }
    const phase = text(get(row, 'Fase'));
    const details: Record<string, string> = {};
    for (const { name: column, i } of detailColumns) {
      const value = text(row[i]);
      if (value && !column.endsWith(' (contenedor)')) details[column] = value;
    }
    container.tasks.push({
      title,
      typeName: text(get(row, 'Tipo')),
      phasePath: phase
        ? phase
            .split(' / ')
            .map((part) => part.trim())
            .filter(Boolean)
        : [],
      status: taskStatus,
      estimatedMinutes:
        minutesValue !== null && Number.isFinite(minutesValue) ? Math.round(minutesValue) : null,
      startDate: date(row, 'Tarea inicio', line),
      endDate: date(row, 'Tarea fin', line),
      responsibleName: text(get(row, 'Responsable')),
      originName: text(get(row, 'Origen')),
      originDetail: text(get(row, 'Detalle del origen')),
      details,
    });
  });
  return {
    source: prototype ? 'Respaldo del prototipo (CSV)' : 'Excel (CSV)',
    containers: [...containers.values()],
    warnings,
  };
}

// --- JSON de Exportar → modelo común ---

const jsonRef = z.object({ id: z.string(), name: z.string() }).nullish();
const jsonExportSchema = z.object({
  format: z.literal('gestor-de-proyectos'),
  version: z.literal(1),
  catalogs: z
    .object({ detailFields: z.array(z.object({ id: z.string(), name: z.string() })).default([]) })
    .default({ detailFields: [] }),
  projects: z.array(
    z.object({
      name: z.string().min(1),
      folio: z.string().nullish(),
      type: z.object({ name: z.string(), behavior: z.enum(['WITH_END', 'ONGOING', 'ON_DEMAND']) }),
      area: z.string().nullish(),
      classification: z.string().nullish(),
      status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'CANCELLED', 'DONE']),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      startDate: z.string().nullish(),
      endDate: z.string().nullish(),
      details: z.record(z.string(), z.unknown()).default({}),
      phases: z
        .array(z.object({ id: z.string(), parentId: z.string().nullable(), name: z.string() }))
        .default([]),
      tasks: z
        .array(
          z.object({
            title: z.string().min(1),
            phaseId: z.string().nullish(),
            type: z.object({ name: z.string() }),
            status: z.enum(['PENDING', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED']),
            estimatedMinutes: z.number().nullish(),
            startDate: z.string().nullish(),
            endDate: z.string().nullish(),
            responsible: jsonRef,
            origin: jsonRef,
            originDetail: z.string().nullish(),
            details: z.record(z.string(), z.unknown()).default({}),
          }),
        )
        .default([]),
    }),
  ),
});

export function jsonToImport(content: string): ImportData {
  let raw: unknown;
  try {
    raw = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch {
    return { source: 'JSON', containers: [], warnings: ['El archivo no es un JSON válido'] };
  }
  const parsed = jsonExportSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      source: 'JSON',
      containers: [],
      warnings: [
        'El JSON no es un respaldo de Exportar (formato "gestor-de-proyectos", versión 1)',
      ],
    };
  }
  const fieldName = new Map(
    parsed.data.catalogs.detailFields.map((field) => [field.id, field.name]),
  );
  const byName = (details: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(details).flatMap(([id, value]) => {
        const name = fieldName.get(id);
        if (!name) return [];
        if (typeof value === 'boolean') return [[name, value ? 'Sí' : 'No']];
        if (typeof value === 'number') return [[name, String(value)]];
        return typeof value === 'string' && value !== '' ? [[name, value]] : [];
      }),
    );
  const date = (value: string | null | undefined) => (value ? normalizeDate(value) : null);
  return {
    source: 'JSON de Exportar',
    warnings: [],
    containers: parsed.data.projects.map((project) => {
      const phaseById = new Map(project.phases.map((phase) => [phase.id, phase]));
      const pathOf = (id: string | null | undefined): string[] => {
        const path: string[] = [];
        let current = id ? phaseById.get(id) : undefined;
        while (current && path.length < 10) {
          path.unshift(current.name);
          current = current.parentId ? phaseById.get(current.parentId) : undefined;
        }
        return path;
      };
      return {
        name: project.name,
        folio: project.folio ?? null,
        typeName: project.type.name,
        behavior: project.type.behavior,
        area: project.area ?? null,
        classification: project.classification ?? null,
        status: project.status,
        priority: project.priority,
        startDate: date(project.startDate),
        endDate: date(project.endDate),
        details: byName(project.details),
        tasks: project.tasks.map((task) => ({
          title: task.title,
          typeName: task.type.name,
          phasePath: pathOf(task.phaseId),
          status: task.status,
          estimatedMinutes: task.estimatedMinutes ?? null,
          startDate: date(task.startDate),
          endDate: date(task.endDate),
          responsibleName: task.responsible?.name ?? null,
          originName: task.origin?.name ?? null,
          originDetail: task.originDetail ?? null,
          details: byName(task.details),
        })),
      };
    }),
  };
}

/** Elige el lector por el contenido: JSON si empieza con "{", si no CSV */
export function readImportFile(content: string): ImportData {
  return content
    .replace(/^\uFEFF/, '')
    .trimStart()
    .startsWith('{')
    ? jsonToImport(content)
    : csvToImport(content);
}
