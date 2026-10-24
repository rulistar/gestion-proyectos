import { describe, expect, it } from 'vitest';
import { daysRemainingLabel, summarizeTasks } from './progress.js';

describe('summarizeTasks (HU-06)', () => {
  it('sin tareas: 0 % y 0 minutos', () => {
    expect(summarizeTasks([])).toEqual({
      totalTasks: 0,
      doneTasks: 0,
      percent: 0,
      pendingMinutes: 0,
    });
  });

  it('% = Hechas ÷ total, redondeado', () => {
    const tasks = [
      { status: 'DONE', estimatedMinutes: null },
      { status: 'PENDING', estimatedMinutes: null },
      { status: 'IN_PROGRESS', estimatedMinutes: null },
    ] as const;
    expect(summarizeTasks(tasks)).toMatchObject({ totalTasks: 3, doneTasks: 1, percent: 33 });
  });

  it('todas Hechas: 100 % y 0 minutos pendientes', () => {
    const tasks = [
      { status: 'DONE', estimatedMinutes: 30 },
      { status: 'DONE', estimatedMinutes: 15 },
    ] as const;
    expect(summarizeTasks(tasks)).toMatchObject({ percent: 100, pendingMinutes: 0 });
  });

  it('minutos pendientes: suma los de las tareas no Hechas; sin estimación cuenta 0', () => {
    const tasks = [
      { status: 'DONE', estimatedMinutes: 60 },
      { status: 'PENDING', estimatedMinutes: 30 },
      { status: 'IN_PROGRESS', estimatedMinutes: 45 },
      { status: 'PENDING', estimatedMinutes: null },
    ] as const;
    expect(summarizeTasks(tasks).pendingMinutes).toBe(75);
  });
});

describe('daysRemainingLabel (HU-06)', () => {
  const today = '2026-10-24';

  it.each([
    [null, 'Sin fecha'],
    ['2026-10-24', 'Termina hoy'],
    ['2026-10-25', 'Falta 1 día'],
    ['2026-11-03', 'Faltan 10 días'],
    ['2026-10-23', 'Vencido hace 1 día'],
    ['2026-10-14', 'Vencido hace 10 días'],
  ])('fin %s → "%s"', (endDate, label) => {
    expect(daysRemainingLabel(endDate, today)).toBe(label);
  });

  it('cruza meses y años sin desfasarse', () => {
    expect(daysRemainingLabel('2027-01-01', '2026-12-31')).toBe('Falta 1 día');
    expect(daysRemainingLabel('2026-03-01', '2026-02-28')).toBe('Falta 1 día');
  });
});
