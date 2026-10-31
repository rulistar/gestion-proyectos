import { describe, expect, it } from 'vitest';
import {
  filterProjects,
  hasActiveFilters,
  projectFiltersSchema,
  sortProjects,
} from './project-filters.js';
import type { Project } from './projects.js';

const progress = {
  totalTasks: 0,
  doneTasks: 0,
  percent: 0,
  pendingMinutes: 0,
  openTasks: 0,
  overdueTasks: 0,
  doneThisMonth: 0,
};

const person = (name: string) => ({
  id: name,
  name,
  userId: null,
  hasAccess: false,
  archived: false,
});

function project(overrides: Partial<Project>): Project {
  return {
    id: overrides.name ?? 'x',
    workspaceId: 'ws',
    type: { id: 'tipo-proyecto', name: 'Proyecto', behavior: 'WITH_END' },
    name: 'Sin nombre',
    folio: null,
    createdById: null,
    description: null,
    requester: null,
    assignedTo: null,
    projectManager: null,
    consultingManager: null,
    businessPartner: null,
    scope: 'WORK',
    area: null,
    classification: null,
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    startDate: null,
    endDate: null,
    notes: null,
    sprint: null,
    sprintActivities: null,
    allowedTaskTypeIds: [],
    details: {},
    startedAt: null,
    finishedAt: null,
    progress,
    ...overrides,
  };
}

const portal = project({
  name: 'Portal de clientes',
  folio: 'PY2610-001',
  area: 'Ventas',
  priority: 'HIGH',
  endDate: '2026-11-15',
  projectManager: person('Carlos Gómez'),
  progress: { ...progress, percent: 60 },
});
const erp = project({
  name: 'Migración ERP',
  folio: 'PY2610-002',
  area: 'Sistemas',
  priority: 'LOW',
  endDate: '2026-12-20',
  sprint: 'Sprint 4',
  progress: { ...progress, percent: 20 },
});
const curso = project({ name: 'Curso de TypeScript', status: 'DONE', area: 'Ventas' });
const cancelado = project({ name: 'App vieja', status: 'CANCELLED' });
const all = [portal, erp, curso, cancelado];

describe('filterProjects (HU-09)', () => {
  it('oculta terminados y cancelados salvo que se pida verlos', () => {
    expect(filterProjects(all, {}).map((p) => p.name)).toEqual([portal.name, erp.name]);
    expect(filterProjects(all, { showClosed: true })).toHaveLength(4);
    // Filtrar por un estado cerrado los muestra aunque la casilla esté apagada
    expect(filterProjects(all, { status: 'DONE' }).map((p) => p.name)).toEqual([curso.name]);
  });

  it('el texto busca en nombre, folio, sprint y personas, sin acentos ni mayúsculas', () => {
    expect(filterProjects(all, { q: 'gomez' })).toEqual([portal]);
    expect(filterProjects(all, { q: 'py2610-002' })).toEqual([erp]);
    expect(filterProjects(all, { q: 'sprint 4' })).toEqual([erp]);
    expect(filterProjects(all, { q: 'portal clientes' })).toEqual([portal]);
  });

  it('combina área, prioridad y "fecha de fin hasta"', () => {
    expect(filterProjects(all, { area: 'Ventas' })).toEqual([portal]);
    expect(filterProjects(all, { priority: 'LOW' })).toEqual([erp]);
    expect(filterProjects(all, { endBy: '2026-11-30' })).toEqual([portal]);
  });

  it('por ámbito (HU-49): "Personal" encuentra los personales y no los de trabajo', () => {
    const mudanza = project({ name: 'Mudanza', scope: 'PERSONAL' });
    expect(filterProjects([...all, mudanza], { scope: 'PERSONAL' })).toEqual([mudanza]);
    expect(filterProjects([...all, mudanza], { scope: 'WORK' })).toEqual([portal, erp]);
  });
});

describe('sortProjects (HU-09)', () => {
  it('ordena ascendente y descendente; los vacíos siempre al final', () => {
    const withoutDate = project({ name: 'Sin fecha' });
    const list = [erp, withoutDate, portal];
    expect(sortProjects(list, 'endDate', 'asc').map((p) => p.name)).toEqual([
      portal.name,
      erp.name,
      'Sin fecha',
    ]);
    expect(sortProjects(list, 'endDate', 'desc').map((p) => p.name)).toEqual([
      erp.name,
      portal.name,
      'Sin fecha',
    ]);
  });

  it('prioridad y estado en su orden lógico; avance numérico', () => {
    expect(sortProjects([erp, portal], 'priority').map((p) => p.priority)).toEqual(['HIGH', 'LOW']);
    expect(sortProjects([erp, portal], 'percent', 'desc').map((p) => p.progress.percent)).toEqual([
      60, 20,
    ]);
  });

  it('sin columna conserva el orden original', () => {
    expect(sortProjects(all, undefined)).toEqual(all);
  });
});

describe('filtros en la URL', () => {
  it('un valor inválido se ignora en vez de romper la página', () => {
    expect(projectFiltersSchema.parse({ status: 'RARO', endBy: 'ayer', q: 'erp' })).toEqual({
      q: 'erp',
    });
  });

  it('hasActiveFilters ignora el orden', () => {
    expect(hasActiveFilters({ sort: 'name', dir: 'desc' })).toBe(false);
    expect(hasActiveFilters({ area: 'Ventas' })).toBe(true);
  });
});
