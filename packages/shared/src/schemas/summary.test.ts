import { describe, expect, it } from 'vitest';
import { countByStatus, upcomingTasks } from './summary.js';

describe('Resumen del proyecto (HU-11)', () => {
  const tasks = [
    { title: 'Examen', status: 'PENDING', endDate: '2026-11-12' },
    { title: 'Repaso', status: 'IN_PROGRESS', endDate: '2026-10-29' },
    { title: 'Lab 1', status: 'DONE', endDate: '2026-10-20' },
    { title: 'Lectura', status: 'PAUSED', endDate: null },
    { title: 'Lab 3', status: 'PENDING', endDate: '2026-11-01' },
    { title: 'Viejo', status: 'CANCELLED', endDate: '2026-10-01' },
  ] as const;

  it('cuenta las tareas por estado', () => {
    expect(countByStatus(tasks)).toEqual({
      PENDING: 2,
      IN_PROGRESS: 1,
      PAUSED: 1,
      DONE: 1,
      CANCELLED: 1,
    });
  });

  it('próximas a vencer: abiertas con fecha, las vencidas primero, con límite', () => {
    expect(upcomingTasks(tasks).map((task) => task.title)).toEqual(['Repaso', 'Lab 3', 'Examen']);
    expect(upcomingTasks(tasks, 1).map((task) => task.title)).toEqual(['Repaso']);
  });
});
