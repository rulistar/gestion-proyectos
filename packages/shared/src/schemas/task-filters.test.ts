import { describe, expect, it } from 'vitest';
import { filterTasks, sortTasks, taskFiltersSchema, type WorkspaceTask } from './task-filters.js';

const TODAY = '2026-10-28';

const linux = {
  id: 'p1',
  name: 'Certificación Linux',
  folio: 'PY2610-001',
  createdById: null,
  type: { id: 't-proyecto', name: 'Proyecto', behavior: 'WITH_END' as const },
};
const erp = {
  id: 'p2',
  name: 'ERP',
  folio: 'MT2610-001',
  createdById: null,
  type: { id: 't-mtto', name: 'Mtto correctivo', behavior: 'ONGOING' as const },
};

const rodrigo = {
  id: 'rodrigo',
  name: 'Rodrigo Gómez',
  userId: null,
  hasAccess: true,
  archived: false,
};

function task(overrides: Partial<WorkspaceTask>): WorkspaceTask {
  return {
    id: overrides.title ?? 'x',
    projectId: linux.id,
    title: 'Sin título',
    type: { id: 'tarea', name: 'Tarea', expedited: false },
    status: 'PENDING',
    estimatedMinutes: null,
    responsible: null,
    createdById: null,
    startDate: null,
    endDate: null,
    statusReason: null,
    startedAt: null,
    completedAt: null,
    project: linux,
    ...overrides,
  };
}

const lecciones = task({ title: 'Lecciones 31 a 40', endDate: '2026-11-02', responsible: rodrigo });
const vencida = task({ title: 'Revisar dump', project: erp, endDate: '2026-10-20' });
const urgente = task({
  title: 'Acceso a GitHub',
  project: erp,
  type: { id: 'fast', name: 'Fast track', expedited: true },
  endDate: '2026-11-10',
});
const hecha = task({ title: 'Lecciones 1 a 20', status: 'DONE', endDate: '2026-10-01' });
const all = [lecciones, vencida, urgente, hecha];
const titles = (tasks: WorkspaceTask[]) => tasks.map((t) => t.title);

describe('filterTasks (HU-39)', () => {
  it('oculta hechas y canceladas salvo que se pida verlas o se filtre por ese estado', () => {
    expect(filterTasks(all, {}, TODAY)).toHaveLength(3);
    expect(filterTasks(all, { showClosed: true }, TODAY)).toHaveLength(4);
    expect(filterTasks(all, { status: 'DONE' }, TODAY)).toEqual([hecha]);
  });

  it('busca en título, responsable y folio o nombre del contenedor, sin acentos', () => {
    expect(filterTasks(all, { q: 'gomez' }, TODAY)).toEqual([lecciones]);
    expect(filterTasks(all, { q: 'mt2610' }, TODAY)).toEqual([vencida, urgente]);
    expect(filterTasks(all, { q: 'certificacion lecciones' }, TODAY)).toEqual([lecciones]);
  });

  it('filtra por sección, contenedor, tipo y responsable (también "sin responsable")', () => {
    expect(filterTasks(all, { behavior: 'ONGOING' }, TODAY)).toEqual([vencida, urgente]);
    expect(filterTasks(all, { projectId: linux.id }, TODAY)).toEqual([lecciones]);
    expect(filterTasks(all, { typeId: 'fast' }, TODAY)).toEqual([urgente]);
    expect(filterTasks(all, { responsibleId: 'rodrigo' }, TODAY)).toEqual([lecciones]);
    expect(filterTasks(all, { responsibleId: 'none' }, TODAY)).toEqual([vencida, urgente]);
  });

  it('"fin hasta" usa la fecha de fin de la tarea; "solo vencidas" las abiertas antes de hoy', () => {
    expect(filterTasks(all, { endBy: '2026-11-03' }, TODAY)).toEqual([lecciones, vencida]);
    // La Hecha con fecha pasada no es vencida aunque se muestren las cerradas
    expect(filterTasks(all, { overdue: true, showClosed: true }, TODAY)).toEqual([vencida]);
  });
});

describe('sortTasks (HU-39)', () => {
  it('sin columna, Fast track primero; por columna, vacíos al final', () => {
    expect(titles(sortTasks([lecciones, urgente], undefined))).toEqual([
      urgente.title,
      lecciones.title,
    ]);
    expect(titles(sortTasks([lecciones, vencida, urgente], 'endDate', 'desc'))).toEqual([
      urgente.title,
      lecciones.title,
      vencida.title,
    ]);
    expect(titles(sortTasks([vencida, lecciones], 'responsible'))).toEqual([
      lecciones.title,
      vencida.title,
    ]);
  });

  it('un filtro inválido en la URL se ignora', () => {
    expect(taskFiltersSchema.parse({ responsibleId: 'otro', status: 'RARO', q: 'erp' })).toEqual({
      q: 'erp',
    });
    expect(taskFiltersSchema.parse({ responsibleId: 'none' })).toEqual({ responsibleId: 'none' });
  });
});
