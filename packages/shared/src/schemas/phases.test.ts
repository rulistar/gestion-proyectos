import { describe, expect, it } from 'vitest';
import {
  createPhaseSchema,
  groupTasksByPhase,
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

describe('Lista agrupada por fase (HU-26)', () => {
  const item = (id: string, phaseId: string | null) => ({ id, phaseId });
  const describeRows = (rows: ReturnType<typeof groupTasksByPhase>) =>
    rows.map((row) =>
      row.kind === 'phase'
        ? `${'  '.repeat(row.depth - 1)}${row.phase.id} (${row.count})`
        : row.kind === 'loose'
          ? `Sin fase (${row.count})`
          : `${'  '.repeat(row.depth - 1)}- ${(row.task as { id: string }).id}`,
    );

  it('cada fase con sus tareas y luego sus subfases; las vacías no aparecen; las sueltas al final', () => {
    const tasks = [
      item('suelta', null),
      item('repaso', 't1a'),
      item('examen', 'm101'),
      item('lab', 't1'),
    ];
    expect(describeRows(groupTasksByPhase(tasks, PHASES))).toEqual([
      'm101 (3)',
      '  - examen',
      '  t1 (2)',
      '    - lab',
      '    t1a (1)',
      '      - repaso',
      'Sin fase (1)',
      '  - suelta',
    ]);
  });

  it('respeta el orden recibido dentro de cada fase', () => {
    const tasks = [item('b', 'm102'), item('a', 'm102')];
    expect(describeRows(groupTasksByPhase(tasks, PHASES))).toEqual(['m102 (2)', '  - b', '  - a']);
  });

  it('una tarea de una fase que ya no existe cuenta como suelta', () => {
    expect(describeRows(groupTasksByPhase([item('x', 'borrada')], PHASES))).toEqual([
      'Sin fase (1)',
      '  - x',
    ]);
  });
});
