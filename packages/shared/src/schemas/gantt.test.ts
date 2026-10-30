import { describe, expect, it } from 'vitest';
import {
  containerGanttStatus,
  ganttBars,
  ganttBox,
  ganttRange,
  ganttTicks,
  isMilestoneType,
  workspaceGanttSearchSchema,
  type GanttTaskInput,
} from './gantt.js';

const TODAY = '2026-11-04'; // miércoles

const task = (changes: Partial<GanttTaskInput> = {}): GanttTaskInput => ({
  status: 'PENDING',
  startDate: null,
  endDate: null,
  typeName: 'Tarea',
  startedOn: null,
  completedOn: null,
  ...changes,
});

describe('Gantt (HU-27)', () => {
  it('barra planeada de inicio a fin; con una sola fecha, de un día', () => {
    expect(
      ganttBars(task({ startDate: '2026-11-02', endDate: '2026-11-06' }), TODAY).planned,
    ).toEqual({ start: '2026-11-02', end: '2026-11-06' });
    expect(ganttBars(task({ endDate: '2026-11-06' }), TODAY).planned).toEqual({
      start: '2026-11-06',
      end: '2026-11-06',
    });
    expect(ganttBars(task(), TODAY).planned).toBeNull();
  });

  it('barra real: hasta que quedó Hecha, o hasta hoy si sigue abierta', () => {
    const done = task({ status: 'DONE', startedOn: '2026-10-28', completedOn: '2026-11-03' });
    expect(ganttBars(done, TODAY).real).toEqual({ start: '2026-10-28', end: '2026-11-03' });
    const open = task({ status: 'IN_PROGRESS', startedOn: '2026-11-02' });
    expect(ganttBars(open, TODAY).real).toEqual({ start: '2026-11-02', end: TODAY });
    // Cancelada: no se sabe hasta cuándo se trabajó
    expect(
      ganttBars(task({ status: 'CANCELLED', startedOn: '2026-11-02' }), TODAY).real,
    ).toBeNull();
    expect(ganttBars(task(), TODAY).real).toBeNull();
  });

  it('vencida: el fin pasó y no está Hecha ni Cancelada', () => {
    expect(ganttBars(task({ endDate: '2026-11-03' }), TODAY).overdue).toBe(true);
    expect(ganttBars(task({ endDate: TODAY }), TODAY).overdue).toBe(false);
    expect(ganttBars(task({ endDate: '2026-11-03', status: 'DONE' }), TODAY).overdue).toBe(false);
  });

  it('las de tipo Entregable son hitos en su fin, sin barra planeada', () => {
    expect(isMilestoneType(' entregable ')).toBe(true);
    expect(isMilestoneType('Entregables')).toBe(false);
    const bars = ganttBars(
      task({ typeName: 'Entregable', startDate: '2026-11-02', endDate: '2026-11-09' }),
      TODAY,
    );
    expect(bars.milestone).toBe('2026-11-09');
    expect(bars.planned).toBeNull();
  });

  it('el rango cubre las fechas y hoy, con margen y ajustado a semanas, meses o trimestres', () => {
    const dates = ['2026-11-10', null, '2026-12-20'];
    // Una semana antes y después, de lunes a domingo
    expect(ganttRange(dates, TODAY, 'week')).toEqual({ start: '2026-10-26', end: '2026-12-27' });
    expect(ganttRange(dates, TODAY, 'month')).toEqual({ start: '2026-11-01', end: '2026-12-31' });
    expect(ganttRange(dates, TODAY, 'quarter')).toEqual({ start: '2026-10-01', end: '2026-12-31' });
    expect(ganttRange([], TODAY, 'month')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
  });

  it('encabezado por semana, mes o trimestre', () => {
    expect(ganttTicks({ start: '2026-10-26', end: '2026-11-15' }, 'week')).toEqual([
      { date: '2026-10-26', label: '26 oct' },
      { date: '2026-11-02', label: '2 nov' },
      { date: '2026-11-09', label: '9 nov' },
    ]);
    expect(
      ganttTicks({ start: '2026-11-01', end: '2027-01-31' }, 'month').map((t) => t.label),
    ).toEqual(['nov 2026', 'dic 2026', 'ene 2027']);
    expect(
      ganttTicks({ start: '2026-10-01', end: '2027-03-31' }, 'quarter').map((t) => t.label),
    ).toEqual(['T4 2026', 'T1 2027']);
  });

  it('posición en píxeles: 24 px por día en la vista semanal', () => {
    const range = { start: '2026-10-26', end: '2026-12-27' };
    expect(ganttBox(range, { start: '2026-10-28', end: '2026-10-30' }, 'week')).toEqual({
      left: 48,
      width: 72,
    });
  });
});

describe('Gantt del espacio (HU-27b)', () => {
  it('la URL guarda sección, zoom y "mostrar hechos"; ignora valores inválidos', () => {
    expect(
      workspaceGanttSearchSchema.parse({ behavior: 'ONGOING', zoom: 'month', showClosed: true }),
    ).toEqual({ behavior: 'ONGOING', zoom: 'month', showClosed: true });
    expect(workspaceGanttSearchSchema.parse({ behavior: 'OTRA', zoom: 'año' })).toEqual({});
  });

  it('el estado del contenedor colorea su barra como el de una tarea', () => {
    expect(containerGanttStatus('NOT_STARTED')).toBe('PENDING');
    expect(containerGanttStatus('PAUSED')).toBe('PAUSED');
    expect(containerGanttStatus('DONE')).toBe('DONE');
  });
});
