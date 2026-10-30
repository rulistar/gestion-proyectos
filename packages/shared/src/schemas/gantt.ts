import { z } from 'zod';
import { normalize } from './project-filters.js';
import type { TaskStatus } from './tasks.js';

/**
 * Gantt (HU-27): reglas puras para dibujar barras planeadas contra reales (ADR-0004 §2.1). Todas
 * las fechas son AAAA-MM-DD; la web convierte antes los instantes reales a la fecha local.
 */

/** Zoom del Gantt; va en la URL */
export const ganttZoomSchema = z.enum(['week', 'month', 'quarter']);
export type GanttZoom = z.infer<typeof ganttZoomSchema>;

/** Un tramo de días, ambos incluidos */
export interface DayRange {
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;

function toTime(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

function fromTime(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** Días de `from` a `to` (negativo si `to` es anterior) */
export function daysBetween(from: string, to: string): number {
  return Math.round((toTime(to) - toTime(from)) / DAY_MS);
}

export function addDays(isoDate: string, days: number): string {
  return fromTime(toTime(isoDate) + days * DAY_MS);
}

/** Lunes de la semana de esa fecha */
function weekStart(isoDate: string): string {
  const day = new Date(toTime(isoDate)).getUTCDay(); // 0 = domingo
  return addDays(isoDate, -((day + 6) % 7));
}

function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

function quarterStart(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  const first = Math.floor((month - 1) / 3) * 3 + 1;
  return `${isoDate.slice(0, 4)}-${String(first).padStart(2, '0')}-01`;
}

function nextMonth(isoDate: string, months = 1): string {
  const date = new Date(toTime(isoDate));
  date.setUTCMonth(date.getUTCMonth() + months, 1);
  return fromTime(date.getTime());
}

/** Píxeles por día según el zoom */
export const GANTT_DAY_WIDTH: Record<GanttZoom, number> = { week: 24, month: 8, quarter: 3 };

/**
 * Rango visible: de lo más temprano a lo más tardío de las fechas dadas y de hoy, con margen y
 * ajustado al inicio de semana, mes o trimestre. Sin fechas, el mes de hoy.
 */
export function ganttRange(
  dates: readonly (string | null)[],
  today: string,
  zoom: GanttZoom,
): DayRange {
  const known = [...dates.filter((date): date is string => date !== null), today];
  const min = known.reduce((a, b) => (b < a ? b : a));
  const max = known.reduce((a, b) => (b > a ? b : a));
  if (zoom === 'week') {
    const start = weekStart(addDays(min, -7));
    return { start, end: addDays(weekStart(addDays(max, 7)), 6) };
  }
  const startOf = zoom === 'month' ? monthStart : quarterStart;
  const step = zoom === 'month' ? 1 : 3;
  return { start: startOf(min), end: addDays(nextMonth(startOf(max), step), -1) };
}

/** Columnas del encabezado: cada semana (lunes), mes o trimestre del rango */
export function ganttTicks(range: DayRange, zoom: GanttZoom): { date: string; label: string }[] {
  const ticks: { date: string; label: string }[] = [];
  let date = range.start;
  while (date <= range.end) {
    ticks.push({ date, label: tickLabel(date, zoom) });
    date = zoom === 'week' ? addDays(date, 7) : nextMonth(date, zoom === 'month' ? 1 : 3);
  }
  return ticks;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function tickLabel(isoDate: string, zoom: GanttZoom): string {
  const month = Number(isoDate.slice(5, 7));
  const year = isoDate.slice(0, 4);
  if (zoom === 'week') return `${Number(isoDate.slice(8, 10))} ${MONTHS[month - 1]}`;
  if (zoom === 'month') return `${MONTHS[month - 1]} ${year}`;
  return `T${Math.ceil(month / 3)} ${year}`;
}

/** Lo que el Gantt necesita de una tarea */
export interface GanttTaskInput {
  status: TaskStatus;
  startDate: string | null;
  endDate: string | null;
  /** Nombre del tipo: "Entregable" se dibuja como hito */
  typeName: string;
  /** Inicio y fin reales, ya como fecha local */
  startedOn: string | null;
  completedOn: string | null;
}

export interface GanttBars {
  /** Barra planeada; null sin fechas planeadas */
  planned: DayRange | null;
  /** Barra real: del inicio real al fin real, o a hoy si sigue abierta; null si no ha empezado */
  real: DayRange | null;
  /** Rombo de un día (tareas de tipo Entregable), en su fin planeado */
  milestone: string | null;
  /** El fin planeado ya pasó y no está Hecha ni Cancelada */
  overdue: boolean;
}

/** Decisión del PO (2026-10-30): las tareas de tipo Entregable son hitos */
export function isMilestoneType(typeName: string): boolean {
  return normalize(typeName.trim()) === 'entregable';
}

export function ganttBars(task: GanttTaskInput, today: string): GanttBars {
  const closed = task.status === 'DONE' || task.status === 'CANCELLED';
  const plannedStart = task.startDate ?? task.endDate;
  const plannedEnd = task.endDate ?? task.startDate;
  let planned: DayRange | null = null;
  if (plannedStart && plannedEnd) {
    // Fechas al revés (fin antes que inicio): se dibuja de la menor a la mayor
    planned =
      plannedStart <= plannedEnd
        ? { start: plannedStart, end: plannedEnd }
        : { start: plannedEnd, end: plannedStart };
  }
  const milestone = isMilestoneType(task.typeName) ? (task.endDate ?? task.startDate) : null;

  let real: DayRange | null = null;
  if (task.startedOn) {
    // Cancelada sin fecha de fin real: no se sabe hasta cuándo se trabajó
    const end = task.completedOn ?? (closed ? null : today);
    if (end) real = { start: task.startedOn, end: end < task.startedOn ? task.startedOn : end };
  }

  return {
    planned: milestone ? null : planned,
    real,
    milestone,
    overdue: !closed && task.endDate !== null && task.endDate < today,
  };
}

/** Posición en píxeles de un tramo dentro del rango */
export function ganttBox(
  range: DayRange,
  span: DayRange,
  zoom: GanttZoom,
): { left: number; width: number } {
  const width = GANTT_DAY_WIDTH[zoom];
  return {
    left: daysBetween(range.start, span.start) * width,
    width: (daysBetween(span.start, span.end) + 1) * width,
  };
}
