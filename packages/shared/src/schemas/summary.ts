import type { TaskStatus } from './tasks.js';

/** Lo que el Resumen necesita de una tarea */
interface SummaryTask {
  status: TaskStatus;
  endDate: string | null;
}

const OPEN: readonly TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'PAUSED'];

/** Tareas por estado, en el orden del tablero (HU-11) */
export function countByStatus(tasks: readonly SummaryTask[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    PENDING: 0,
    IN_PROGRESS: 0,
    PAUSED: 0,
    DONE: 0,
    CANCELLED: 0,
  };
  for (const task of tasks) counts[task.status] += 1;
  return counts;
}

/**
 * Próximas a vencer (HU-11): las abiertas con fecha de fin, de la más atrasada a la más lejana
 * (las vencidas quedan primero). Ej.: "Repaso" (venció hace 2 días), "Lab 3" (mañana)…
 */
export function upcomingTasks<T extends SummaryTask>(tasks: readonly T[], limit = 8): T[] {
  return tasks
    .filter((task) => OPEN.includes(task.status) && task.endDate !== null)
    .sort((a, b) => a.endDate!.localeCompare(b.endDate!))
    .slice(0, limit);
}
