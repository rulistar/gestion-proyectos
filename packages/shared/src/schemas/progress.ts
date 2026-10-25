import { z } from 'zod';
import type { TaskStatus } from './tasks.js';

/** Avance de un proyecto (HU-06); lo calcula la API sin contar las tareas borradas (RNF-05) */
export const projectProgressSchema = z.object({
  totalTasks: z.number().int(),
  doneTasks: z.number().int(),
  /** % de tareas Hechas sobre las no canceladas, redondeado; 0 si no hay tareas */
  percent: z.number().int().min(0).max(100),
  /** Suma de los minutos estimados de las tareas que no están Hechas */
  pendingMinutes: z.number().int(),
});
export type ProjectProgress = z.infer<typeof projectProgressSchema>;

/**
 * Reglas de cálculo del prototipo (ADR-0002 §1.1), con los estados de HU-24: una tarea
 * **Cancelada no cuenta** (ni en el total ni en los minutos); una **Pausada sí**, porque sigue
 * siendo trabajo pendiente.
 */
export function summarizeTasks(
  tasks: readonly { status: TaskStatus; estimatedMinutes: number | null }[],
): ProjectProgress {
  const counted = tasks.filter((task) => task.status !== 'CANCELLED');
  const doneTasks = counted.filter((task) => task.status === 'DONE').length;
  const pendingMinutes = counted
    .filter((task) => task.status !== 'DONE')
    .reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);
  return {
    totalTasks: counted.length,
    doneTasks,
    percent: counted.length === 0 ? 0 : Math.round((doneTasks / counted.length) * 100),
    pendingMinutes,
  };
}

const MS_PER_DAY = 86_400_000;

/** Días de `from` a `to` (fechas AAAA-MM-DD); negativo si `to` es anterior */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

/**
 * Días restantes hasta la fecha de fin. `today` es la fecha de hoy en la zona horaria del
 * usuario (AAAA-MM-DD): se recibe de fuera para que el resultado no dependa del servidor.
 */
export function daysRemainingLabel(endDate: string | null, today: string): string {
  if (!endDate) return 'Sin fecha';
  const days = daysBetween(today, endDate);
  if (days === 0) return 'Termina hoy';
  if (days > 0) return days === 1 ? 'Falta 1 día' : `Faltan ${days} días`;
  return days === -1 ? 'Vencido hace 1 día' : `Vencido hace ${-days} días`;
}
