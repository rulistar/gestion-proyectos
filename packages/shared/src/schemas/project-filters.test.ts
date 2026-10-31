import { describe, expect, it } from 'vitest';
import {
  filterProjects,
  inYear,
  projectYears,
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
    createdAt: '2026-01-15T12:00:00.000Z',
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
const curso = project({
  name: 'Curso de TypeScript',
  status: 'DONE',
  area: 'Ventas',
  finishedAt: '2026-03-10T12:00:00.000Z',
});
const cancelado = project({
  name: 'App vieja',
  status: 'CANCELLED',
  finishedAt: '2026-05-02T12:00:00.000Z',
});
const all = [portal, erp, curso, cancelado];

describe('filterProjects (HU-09)', () => {
  it('por omisión, los abiertos; Cerrados o Ambos muestran los terminados y cancelados', () => {
    expect(filterProjects(all, {}, 2026).map((p) => p.name)).toEqual([portal.name, erp.name]);
    expect(filterProjects(all, { state: 'all' }, 2026)).toHaveLength(4);
    expect(filterProjects(all, { state: 'closed' }, 2026)).toEqual([curso, cancelado]);
    // Filtrar por un estado cerrado los muestra aunque se vean solo los abiertos
    expect(filterProjects(all, { status: 'DONE' }, 2026).map((p) => p.name)).toEqual([curso.name]);
  });

  it('el texto busca en nombre, folio, sprint y personas, sin acentos ni mayúsculas', () => {
    expect(filterProjects(all, { q: 'gomez' }, 2026)).toEqual([portal]);
    expect(filterProjects(all, { q: 'py2610-002' }, 2026)).toEqual([erp]);
    expect(filterProjects(all, { q: 'sprint 4' }, 2026)).toEqual([erp]);
    expect(filterProjects(all, { q: 'portal clientes' }, 2026)).toEqual([portal]);
  });

  it('combina área, prioridad y "fecha de fin hasta"', () => {
    expect(filterProjects(all, { area: 'Ventas' }, 2026)).toEqual([portal]);
    expect(filterProjects(all, { priority: 'LOW' }, 2026)).toEqual([erp]);
    expect(filterProjects(all, { endBy: '2026-11-30' }, 2026)).toEqual([portal]);
  });

  it('por ámbito (HU-49): "Personal" encuentra los personales y no los de trabajo', () => {
    const mudanza = project({ name: 'Mudanza', scope: 'PERSONAL' });
    expect(filterProjects([...all, mudanza], { scope: 'PERSONAL' }, 2026)).toEqual([mudanza]);
    expect(filterProjects([...all, mudanza], { scope: 'WORK' }, 2026)).toEqual([portal, erp]);
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

describe('vista tabla o tablero (HU-10)', () => {
  it('la vista va en la URL pero no cuenta como filtro', () => {
    expect(projectFiltersSchema.parse({ view: 'board' })).toEqual({ view: 'board' });
    expect(projectFiltersSchema.parse({ view: 'gantt' })).toEqual({});
    expect(hasActiveFilters({ view: 'board', sort: 'name' })).toBe(false);
  });
});

describe('filtro por año (HU-55)', () => {
  // El ejemplo del PO: Portal (abierto), Migración (terminada en marzo de 2026), Curso (terminado en 2025)
  const portalClientes = project({
    name: 'Portal clientes',
    createdAt: '2025-11-03T12:00:00.000Z',
  });
  const migracion = project({
    name: 'Migración ERP',
    status: 'DONE',
    createdAt: '2025-06-01T12:00:00.000Z',
    finishedAt: '2026-03-15T12:00:00.000Z',
  });
  const cursoLinux = project({
    name: 'Curso Linux',
    status: 'DONE',
    createdAt: '2025-01-10T12:00:00.000Z',
    finishedAt: '2025-08-20T12:00:00.000Z',
  });
  const nuevo2027 = project({ name: 'Plan 2027', createdAt: '2027-01-05T12:00:00.000Z' });
  const list = [portalClientes, migracion, cursoLinux, nuevo2027];
  const names = (filters: Parameters<typeof filterProjects>[1], year = 2027) =>
    filterProjects(list, filters, year).map((p) => p.name);

  it('2026 con Ambos: Portal clientes y Migración ERP; Curso Linux no', () => {
    expect(names({ year: 2026, state: 'all' })).toEqual(['Portal clientes', 'Migración ERP']);
    expect(names({ year: 2026 })).toEqual(['Portal clientes']);
    expect(names({ year: 2026, state: 'closed' })).toEqual(['Migración ERP']);
  });

  it('un año pasado no muestra lo creado después; el en curso es el de omisión', () => {
    expect(names({ year: 2025 })).toEqual(['Portal clientes']);
    expect(names({ year: 2025, state: 'closed' })).toEqual(['Curso Linux']);
    expect(names({})).toEqual(['Portal clientes', 'Plan 2027']);
  });

  it('cerrado sin fecha de fin real: cuenta el año del fin planeado o del alta', () => {
    expect(inYear({ ...cursoLinux, finishedAt: null, endDate: '2024-12-01' }, 2024, 'closed')).toBe(
      true,
    );
    expect(inYear({ ...cursoLinux, finishedAt: null, endDate: null }, 2025, 'closed')).toBe(true);
  });

  it('años del combo: del primero con datos al en curso, el más reciente primero', () => {
    expect(projectYears(list, 2027)).toEqual([2027, 2026, 2025]);
    expect(projectYears([], 2026)).toEqual([2026]);
  });

  it('el año y el estado van en la URL; valores inválidos se ignoran', () => {
    expect(projectFiltersSchema.parse({ year: '2026', state: 'closed' })).toEqual({
      year: 2026,
      state: 'closed',
    });
    expect(projectFiltersSchema.parse({ year: 'hoy', state: 'viejos' })).toEqual({});
  });
});
