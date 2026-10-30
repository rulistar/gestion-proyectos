import { describe, expect, it } from 'vitest';
import {
  createPhaseSchema,
  loosePhaseTasks,
  orderedPhases,
  phaseDepths,
  phaseDescendantIds,
  summarizePhase,
  type PhaseTask,
} from './phases.js';

// Proyecto "Certificación Linux" (el ejemplo que confirmó el PO)
const phase = (id: string, parentId: string | null, position = 0) => ({ id, parentId, position });
const PHASES = [
  phase('m102', null, 1),
  phase('m101', null, 0),
  phase('t2', 'm101', 1),
  phase('t1', 'm101', 0),
  phase('t1a', 't1', 0),
];

const task = (phaseId: string | null, changes: Partial<PhaseTask> = {}): PhaseTask => ({
  phaseId,
  status: 'PENDING',
  estimatedMinutes: null,
  startDate: null,
  endDate: null,
  ...changes,
});

describe('fases (HU-07)', () => {
  it('calcula el nivel de cada fase', () => {
    const depths = phaseDepths(PHASES);
    expect(depths.get('m101')).toBe(1);
    expect(depths.get('t1')).toBe(2);
    expect(depths.get('t1a')).toBe(3);
  });

  it('una fase incluye a todas sus subfases, a cualquier nivel', () => {
    expect([...phaseDescendantIds(PHASES, 'm101')].sort()).toEqual(['m101', 't1', 't1a', 't2']);
    expect([...phaseDescendantIds(PHASES, 'm102')]).toEqual(['m102']);
  });

  it('ordena como esquema: cada madre seguida de sus hijas, por posición', () => {
    expect(orderedPhases(PHASES).map(({ phase, depth }) => `${depth}:${phase.id}`)).toEqual([
      '1:m101',
      '2:t1',
      '3:t1a',
      '2:t2',
      '1:m102',
    ]);
  });

  it('el avance y las fechas salen de todo lo que contiene', () => {
    const tasks = [
      task('t1', { status: 'DONE', startDate: '2026-11-01', endDate: '2026-11-05' }),
      task('t1a', { status: 'DONE', endDate: '2026-11-10' }),
      task('t2', { estimatedMinutes: 60, startDate: '2026-11-11', endDate: '2026-11-30' }),
      task('t2', { status: 'CANCELLED', endDate: '2026-12-31' }),
      task('m102', { startDate: '2026-12-01' }),
      task(null, { status: 'DONE' }),
    ];
    expect(summarizePhase(PHASES, tasks, 'm101')).toEqual({
      totalTasks: 3,
      doneTasks: 2,
      percent: 67,
      pendingMinutes: 60,
      startDate: '2026-11-01',
      // La cancelada no cuenta en el avance, pero su fecha sí está en la fase
      endDate: '2026-12-31',
    });
    expect(summarizePhase(PHASES, tasks, 't1')).toMatchObject({
      percent: 100,
      startDate: '2026-11-01',
      endDate: '2026-11-10',
    });
  });

  it('una fase sin tareas tiene 0 % y no tiene fechas', () => {
    expect(summarizePhase(PHASES, [], 'm102')).toMatchObject({
      totalTasks: 0,
      percent: 0,
      startDate: null,
      endDate: null,
    });
  });

  it('son sueltas las tareas sin fase o con una fase que no está en la lista', () => {
    const tasks = [task(null), task('m101'), task('borrada')];
    expect(loosePhaseTasks(PHASES, tasks)).toEqual([task(null), task('borrada')]);
  });

  it('el nombre es obligatorio; sin madre va al primer nivel', () => {
    expect(createPhaseSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(createPhaseSchema.parse({ name: ' Módulo 101 ', parentId: '' })).toEqual({
      name: 'Módulo 101',
      parentId: null,
    });
  });
});
