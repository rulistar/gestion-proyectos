import { containerGanttStatus, ganttBars, type GanttBars } from '@gestion/shared';
import type { Project, Task } from '@gestion/shared';
import { localDateOf } from './dates';

/** Barras de una tarea (HU-27): las fechas reales se pasan a la fecha local del usuario */
export function taskBars(task: Task, today: string): GanttBars {
  return ganttBars(
    {
      status: task.status,
      startDate: task.startDate,
      endDate: task.endDate,
      typeName: task.type.name,
      startedOn: localDateOf(task.startedAt),
      completedOn: localDateOf(task.completedAt),
    },
    today,
  );
}

/** Barras de un contenedor: sus fechas planeadas y las reales (ADR-0004 §2.1) */
export function containerBars(project: Project, today: string): GanttBars {
  return ganttBars(
    {
      status: containerGanttStatus(project.status),
      startDate: project.startDate,
      endDate: project.endDate,
      typeName: '',
      startedOn: localDateOf(project.startedAt),
      completedOn: localDateOf(project.finishedAt),
    },
    today,
  );
}

/** Por fecha de inicio planeada (o de fin); sin fechas al final */
export function byPlannedStart(
  a: Pick<Task, 'startDate' | 'endDate'>,
  b: Pick<Task, 'startDate' | 'endDate'>,
): number {
  const first = (item: Pick<Task, 'startDate' | 'endDate'>) =>
    item.startDate ?? item.endDate ?? '9999-12-31';
  return first(a).localeCompare(first(b));
}

/** Todas las fechas de unas barras, para calcular el rango visible */
export function barDates(bars: GanttBars): (string | null)[] {
  return [
    bars.planned?.start ?? null,
    bars.planned?.end ?? null,
    bars.real?.start ?? null,
    bars.real?.end ?? null,
    bars.milestone,
  ];
}
