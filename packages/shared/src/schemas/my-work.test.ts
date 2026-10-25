import { describe, expect, it } from 'vitest';
import { groupMyWork } from './my-work.js';
import type { TaskStatus } from './tasks.js';

const TODAY = '2026-10-28'; // miércoles
const WEEK_START = '2026-10-26T06:00:00.000Z'; // lunes 00:00 en Ciudad de México

function task(
  title: string,
  status: TaskStatus,
  endDate: string | null,
  completedAt: string | null = null,
) {
  return { title, status, endDate, completedAt };
}

describe('groupMyWork (HU-28b)', () => {
  it('agrupa lo abierto en vencidas, hoy, esta semana y más adelante', () => {
    const work = groupMyWork(
      [
        task('sin fecha', 'PENDING', null),
        task('dentro de 10 días', 'PENDING', '2026-11-07'),
        task('dentro de 7 días', 'PENDING', '2026-11-04'),
        task('mañana', 'IN_PROGRESS', '2026-10-29'),
        task('hoy', 'PAUSED', TODAY),
        task('ayer', 'PENDING', '2026-10-27'),
        task('hace una semana', 'PENDING', '2026-10-21'),
      ],
      TODAY,
      WEEK_START,
    );

    const titles = (list: { title: string }[]) => list.map((t) => t.title);
    expect(titles(work.overdue)).toEqual(['hace una semana', 'ayer']);
    expect(titles(work.today)).toEqual(['hoy']);
    expect(titles(work.thisWeek)).toEqual(['mañana', 'dentro de 7 días']);
    expect(titles(work.later)).toEqual(['dentro de 10 días', 'sin fecha']);
  });

  it('las hechas y canceladas no aparecen en los grupos, aunque estén vencidas', () => {
    const work = groupMyWork(
      [
        task('hecha', 'DONE', '2026-10-20', '2026-10-27T15:00:00.000Z'),
        task('x', 'CANCELLED', '2026-10-20'),
      ],
      TODAY,
      WEEK_START,
    );
    expect(work.overdue).toEqual([]);
    expect(work.kpis.overdue).toBe(0);
  });

  it('calcula los indicadores; "hechas esta semana" cuenta desde el lunes local', () => {
    const work = groupMyWork(
      [
        task('a', 'IN_PROGRESS', TODAY),
        task('b', 'IN_PROGRESS', null),
        task('c', 'PENDING', '2026-10-01'),
        task('lunes temprano', 'DONE', null, '2026-10-26T06:30:00.000Z'),
        task('domingo noche', 'DONE', null, '2026-10-26T05:30:00.000Z'),
      ],
      TODAY,
      WEEK_START,
    );
    expect(work.kpis).toEqual({ dueToday: 1, overdue: 1, inProgress: 2, doneThisWeek: 1 });
  });
});
