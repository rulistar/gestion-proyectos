import { describe, expect, it } from 'vitest';
import {
  indicatorYears,
  projectsByEndMonth,
  projectsByStatus,
  timeIndicators,
  type TimedItem,
} from './charts.js';

// Fecha local fija en UTC−6 (México): así la prueba no depende de la zona de la máquina
const mexico = (instant: string) =>
  new Date(Date.parse(instant) - 6 * 3_600_000).toISOString().slice(0, 10);

describe('projectsByEndMonth (HU-12)', () => {
  it('agrupa por el mes del fin planeado: a tiempo, tarde y abiertos', () => {
    const chart = projectsByEndMonth(
      [
        // Portal: terminado el 28/03, antes de su fin → marzo, a tiempo
        { status: 'DONE', endDate: '2026-03-31', finishedAt: '2026-03-28T18:00:00.000Z' },
        // ERP: terminado el 2/04 con fin el 15/03 → marzo, tarde
        { status: 'DONE', endDate: '2026-03-15', finishedAt: '2026-04-02T18:00:00.000Z' },
        // Lab: en curso → mayo, abierto
        { status: 'IN_PROGRESS', endDate: '2026-05-10', finishedAt: null },
        // Terminado a las 20:00 del día límite en México (02:00 UTC del día siguiente): a tiempo
        { status: 'DONE', endDate: '2026-06-30', finishedAt: '2026-07-01T02:00:00.000Z' },
        // Terminado sin fin real (antes de ADR-0004): a tiempo
        { status: 'DONE', endDate: '2026-06-01', finishedAt: null },
        { status: 'CANCELLED', endDate: '2026-03-01', finishedAt: '2026-03-02T18:00:00.000Z' },
        { status: 'NOT_STARTED', endDate: null, finishedAt: null },
        { status: 'NOT_STARTED', endDate: '2027-01-15', finishedAt: null },
      ],
      2026,
      mexico,
    );
    expect(chart.months[2]).toEqual({ month: 3, onTime: 1, late: 1, open: 0 });
    expect(chart.months[4]).toEqual({ month: 5, onTime: 0, late: 0, open: 1 });
    expect(chart.months[5]).toEqual({ month: 6, onTime: 2, late: 0, open: 0 });
    expect([chart.noDate, chart.otherYears]).toEqual([1, 1]);
    const total = chart.months.reduce((sum, m) => sum + m.onTime + m.late + m.open, 0);
    expect(total).toBe(5);
  });
});

describe('projectsByStatus (HU-12)', () => {
  it('cuenta por estado en el orden del tablero, con ceros', () => {
    expect(
      projectsByStatus([{ status: 'DONE' }, { status: 'IN_PROGRESS' }, { status: 'DONE' }]),
    ).toEqual([
      { status: 'NOT_STARTED', count: 0 },
      { status: 'IN_PROGRESS', count: 1 },
      { status: 'PAUSED', count: 0 },
      { status: 'DONE', count: 2 },
      { status: 'CANCELLED', count: 0 },
    ]);
  });
});

const item = (overrides: Partial<TimedItem>): TimedItem => ({
  typeName: 'Incidencia',
  createdAt: '2026-03-01T15:00:00.000Z',
  startedAt: '2026-03-02T15:00:00.000Z',
  finishedAt: '2026-03-03T15:00:00.000Z',
  endDate: '2026-03-04',
  ...overrides,
});

describe('timeIndicators (HU-12)', () => {
  it('promedia espera, trabajo y atención, y calcula % a tiempo y desviación', () => {
    const result = timeIndicators(
      [
        item({}),
        item({ finishedAt: '2026-03-05T15:00:00.000Z' }),
        item({ typeName: 'Tarea', startedAt: null, endDate: null }),
        // Abierta (sin fin real) y terminada en otro año: no cuentan
        item({ finishedAt: null }),
        item({ finishedAt: '2025-12-10T15:00:00.000Z' }),
      ],
      2026,
      mexico,
    );
    expect(result).toEqual([
      {
        typeName: 'Incidencia',
        count: 2,
        waitDays: 1,
        workDays: 2,
        leadDays: 3,
        onTimePercent: 50,
        // 3/03 vs 4/03 → −1; 5/03 vs 4/03 → +1
        deviationDays: 0,
      },
      {
        typeName: 'Tarea',
        count: 1,
        waitDays: null,
        workDays: null,
        leadDays: 2,
        onTimePercent: null,
        deviationDays: null,
      },
    ]);
  });

  it('el año es el de la fecha local del fin real', () => {
    // 31/12 a las 21:00 en México = 1/01 03:00 UTC: cuenta en 2025
    const lateNight = item({ finishedAt: '2026-01-01T03:00:00.000Z' });
    expect(timeIndicators([lateNight], 2025, mexico)).toHaveLength(1);
    expect(timeIndicators([lateNight], 2026, mexico)).toHaveLength(0);
    expect(indicatorYears([lateNight, item({ finishedAt: null })], 2026, mexico)).toEqual([
      2026, 2025,
    ]);
  });
});
