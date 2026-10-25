import { z } from 'zod';
import { taskSchema, type TaskStatus } from './tasks.js';

/** Una tarea mía con el nombre de su proyecto (HU-28b) */
export const myTaskSchema = taskSchema.extend({ projectName: z.string() });
export type MyTask = z.infer<typeof myTaskSchema>;

/** Respuesta de GET /workspaces/:workspaceId/my-tasks: abiertas y hechas desde `doneSince` */
export const myTaskListSchema = z.array(myTaskSchema);

/** Query de GET .../my-tasks: desde cuándo incluir las Hechas (por omisión, 7 días atrás) */
export const myTasksQuerySchema = z.object({ doneSince: z.iso.datetime().optional() });

/** Trabajo abierto: lo que todavía hay que hacer (Pausada sigue pendiente, decisión del PO) */
const OPEN: readonly TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'PAUSED'];

export interface MyWork<T> {
  overdue: T[];
  today: T[];
  /** Vencen en los próximos 7 días (sin contar hoy) */
  thisWeek: T[];
  /** Sin fecha de fin o con fin más adelante */
  later: T[];
  kpis: { dueToday: number; overdue: number; inProgress: number; doneThisWeek: number };
}

/** Suma días a una fecha AAAA-MM-DD */
function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Agrupa mis tareas por fecha de fin (HU-28b). `today` es la fecha local del usuario
 * (AAAA-MM-DD) y `weekStart` el instante en que empezó su semana (lunes 00:00 local): ambos se
 * reciben de fuera para no depender de la zona horaria del servidor. Las canceladas no cuentan.
 */
export function groupMyWork<
  T extends { status: TaskStatus; endDate: string | null; completedAt: string | null },
>(tasks: readonly T[], today: string, weekStart: string): MyWork<T> {
  const open = tasks.filter((task) => OPEN.includes(task.status));
  const weekEnd = addDays(today, 7);
  const byDate = (a: T, b: T) => (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999');

  const overdue = open.filter((t) => t.endDate !== null && t.endDate < today).sort(byDate);
  const dueToday = open.filter((t) => t.endDate === today);
  const thisWeek = open
    .filter((t) => t.endDate !== null && t.endDate > today && t.endDate <= weekEnd)
    .sort(byDate);
  const later = open.filter((t) => t.endDate === null || t.endDate > weekEnd).sort(byDate);
  const doneThisWeek = tasks.filter(
    (t) =>
      t.status === 'DONE' &&
      t.completedAt !== null &&
      Date.parse(t.completedAt) >= Date.parse(weekStart),
  ).length;

  return {
    overdue,
    today: dueToday,
    thisWeek,
    later,
    kpis: {
      dueToday: dueToday.length,
      overdue: overdue.length,
      inProgress: open.filter((t) => t.status === 'IN_PROGRESS').length,
      doneThisWeek,
    },
  };
}
