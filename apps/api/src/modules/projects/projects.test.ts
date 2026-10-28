import {
  folioPeriod,
  formatFolio,
  projectListSchema,
  projectSchema,
  type MembershipRole,
} from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { auditCreate, auditSoftDelete } from '../../db/audit.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createWorkspace } from '../workspaces/workspaces.service.js';

const db = createTestDb();
const app = buildApp({ db });

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

type Cookies = Record<string, string>;

/** Workspace de Ana (Admin) con un miembro extra por cada rol que se pida */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });

  async function withRole(email: string, role: MembershipRole) {
    const user = await userWithSession(db, email);
    await addMember(db, ws.id, user.user.id, role);
    return user;
  }
  return { ana, ws, withRole };
}

const url = (workspaceId: string, projectId?: string) =>
  `/api/v1/workspaces/${workspaceId}/projects${projectId ? `/${projectId}` : ''}`;

function create(cookies: Cookies, workspaceId: string, payload: object) {
  return app.inject({ method: 'POST', url: url(workspaceId), cookies, payload });
}

function update(cookies: Cookies, workspaceId: string, projectId: string, payload: object) {
  return app.inject({ method: 'PUT', url: url(workspaceId, projectId), cookies, payload });
}

async function createOk(cookies: Cookies, workspaceId: string, payload: object) {
  const response = await create(cookies, workspaceId, payload);
  expect(response.statusCode).toBe(201);
  return projectSchema.parse(response.json());
}

describe('sin sesión o sin membresía', () => {
  it('sin sesión responde 401', async () => {
    const { ws } = await setup();
    expect((await app.inject({ url: url(ws.id) })).statusCode).toBe(401);
    expect((await create({}, ws.id, { name: 'X' })).statusCode).toBe(401);
  });

  it('quien no es miembro recibe 404 y no crea nada', async () => {
    const { ws } = await setup();
    const luis = await userWithSession(db, 'luis@example.com');

    expect((await app.inject({ url: url(ws.id), cookies: luis.cookies })).statusCode).toBe(404);
    expect((await create(luis.cookies, ws.id, { name: 'Intruso' })).statusCode).toBe(404);
    expect(await db.project.count()).toBe(0);
  });
});

describe('POST /workspaces/:workspaceId/projects (HU-05)', () => {
  it('crea el proyecto normalizando los datos y con valores por defecto', async () => {
    const { ana, ws } = await setup();

    const project = await createOk(ana.cookies, ws.id, {
      name: '  Curso de TypeScript ',
      area: ' Estudio ',
      classification: '',
      startDate: '2026-11-01',
      endDate: '',
    });

    expect(project).toEqual({
      id: project.id,
      workspaceId: ws.id,
      // Sin tipo pedido, el primer tipo "Con fin" del espacio (HU-21)
      type: { id: project.type.id, name: 'Proyecto', behavior: 'WITH_END' },
      name: 'Curso de TypeScript',
      // Sin folio, el primero automático del mes en UTC (HU-38; sin ?today= de la web)
      folio: formatFolio('PY', folioPeriod(new Date().toISOString().slice(0, 10)), 1),
      createdById: ana.user.id,
      description: null,
      requester: null,
      assignedTo: null,
      projectManager: null,
      consultingManager: null,
      businessPartner: null,
      area: 'Estudio',
      classification: null,
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      startDate: '2026-11-01',
      endDate: null,
      notes: null,
      sprint: null,
      sprintActivities: null,
      allowedTaskTypeIds: [],
      startedAt: null,
      finishedAt: null,
      progress: {
        totalTasks: 0,
        doneTasks: 0,
        percent: 0,
        pendingMinutes: 0,
        openTasks: 0,
        overdueTasks: 0,
        doneThisMonth: 0,
      },
    });
  });

  it('registra quién lo creó (RNF-01)', async () => {
    const { ana, ws } = await setup();

    const { id } = await createOk(ana.cookies, ws.id, { name: 'Proyecto' });

    const row = await db.project.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ createdById: ana.user.id, updatedById: ana.user.id });
  });

  it('un Miembro puede crear; un Lector recibe 403', async () => {
    const { ws, withRole } = await setup();
    const miembro = await withRole('miembro@example.com', 'MEMBER');
    const lector = await withRole('lector@example.com', 'VIEWER');

    await createOk(miembro.cookies, ws.id, { name: 'Del miembro' });
    const denied = await create(lector.cookies, ws.id, { name: 'Del lector' });

    expect(denied.statusCode).toBe(403);
    expect(await db.project.count()).toBe(1);
  });

  it.each([
    ['sin nombre', { name: '   ' }],
    ['con fin antes del inicio', { name: 'X', startDate: '2026-11-10', endDate: '2026-11-01' }],
    ['con una fecha que no existe', { name: 'X', endDate: '2026-02-30' }],
    ['con un estado desconocido', { name: 'X', status: 'ARCHIVED' }],
    ['con notas demasiado largas', { name: 'X', notes: 'x'.repeat(2001) }],
  ])('rechaza un proyecto %s con 400', async (_caso, payload) => {
    const { ana, ws } = await setup();

    expect((await create(ana.cookies, ws.id, payload)).statusCode).toBe(400);
    expect(await db.project.count()).toBe(0);
  });
});

describe('GET /workspaces/:workspaceId/projects', () => {
  it('lista los proyectos del workspace, sin los de la papelera ni los de otros workspaces', async () => {
    const { ana, ws, withRole } = await setup();
    const lector = await withRole('lector@example.com', 'VIEWER');
    const otherWs = await createWorkspace(db, ana.user.id, { name: 'Otro' });

    const kept = await createOk(ana.cookies, ws.id, { name: 'Activo' });
    const trashed = await createOk(ana.cookies, ws.id, { name: 'Borrado' });
    await createOk(ana.cookies, otherWs.id, { name: 'De otro workspace' });
    await db.project.update({ where: { id: trashed.id }, data: auditSoftDelete(ana.user.id) });

    // El Lector también puede ver la lista
    const response = await app.inject({ url: url(ws.id), cookies: lector.cookies });

    expect(projectListSchema.parse(response.json())).toEqual([kept]);
  });
});

describe('avance del proyecto (HU-06)', () => {
  it('calcula % y minutos pendientes sin contar las tareas en la papelera', async () => {
    const { ana, ws } = await setup();
    const project = await createOk(ana.cookies, ws.id, { name: 'Curso' });
    const { id: typeId } = await db.taskType.findFirstOrThrow({ where: { workspaceId: ws.id } });
    const task = (status: 'PENDING' | 'DONE', estimatedMinutes: number, deleted = false) =>
      db.task.create({
        data: {
          workspaceId: ws.id,
          projectId: project.id,
          typeId,
          title: 'T',
          status,
          estimatedMinutes,
          ...auditCreate(ana.user.id),
          ...(deleted && auditSoftDelete(ana.user.id)),
        },
      });
    await task('DONE', 60);
    await task('PENDING', 30);
    await task('PENDING', 500, true); // en la papelera: no cuenta

    const list = projectListSchema.parse(
      (await app.inject({ url: url(ws.id), cookies: ana.cookies })).json(),
    );
    const detail = projectSchema.parse(
      (await app.inject({ url: url(ws.id, project.id), cookies: ana.cookies })).json(),
    );

    const expected = { totalTasks: 2, doneTasks: 1, percent: 50, pendingMinutes: 30 };
    expect(list[0]?.progress).toMatchObject(expected);
    expect(detail.progress).toMatchObject(expected);
  });
});

describe('GET /workspaces/:workspaceId/projects/:projectId', () => {
  it('devuelve el proyecto', async () => {
    const { ana, ws } = await setup();
    const project = await createOk(ana.cookies, ws.id, { name: 'Proyecto' });

    const response = await app.inject({ url: url(ws.id, project.id), cookies: ana.cookies });

    expect(response.json()).toEqual(project);
  });

  it('no deja ver un proyecto de otro workspace a través del mío (404)', async () => {
    const { ws } = await setup();
    const luis = await userWithSession(db, 'luis@example.com');
    const luisWs = await createWorkspace(db, luis.user.id, { name: 'De Luis' });
    const secret = await createOk(luis.cookies, luisWs.id, { name: 'Secreto' });
    // Luis también es miembro del workspace de Ana, pero el proyecto no es de ese workspace
    await addMember(db, ws.id, luis.user.id, 'MEMBER');

    const response = await app.inject({ url: url(ws.id, secret.id), cookies: luis.cookies });

    expect(response.statusCode).toBe(404);
  });

  it('responde 404 a un ID no válido', async () => {
    const { ana, ws } = await setup();
    const response = await app.inject({ url: url(ws.id, 'no-es-un-id'), cookies: ana.cookies });
    expect(response.statusCode).toBe(404);
  });
});

describe('PUT /workspaces/:workspaceId/projects/:projectId', () => {
  it('actualiza el proyecto y registra quién lo modificó (RNF-01)', async () => {
    const { ana, ws, withRole } = await setup();
    const miembro = await withRole('miembro@example.com', 'MEMBER');
    const project = await createOk(ana.cookies, ws.id, { name: 'Proyecto' });

    const response = await update(miembro.cookies, ws.id, project.id, {
      name: 'Proyecto renombrado',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      endDate: '2026-12-15',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'Proyecto renombrado',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      endDate: '2026-12-15',
    });
    const row = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(row).toMatchObject({ createdById: ana.user.id, updatedById: miembro.user.id });
  });

  it('un Lector recibe 403 y el proyecto no cambia', async () => {
    const { ana, ws, withRole } = await setup();
    const lector = await withRole('lector@example.com', 'VIEWER');
    const project = await createOk(ana.cookies, ws.id, { name: 'Original' });

    const response = await update(lector.cookies, ws.id, project.id, { name: 'Cambiado' });

    expect(response.statusCode).toBe(403);
    const row = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(row.name).toBe('Original');
  });

  it('responde 404 si el proyecto está en la papelera', async () => {
    const { ana, ws } = await setup();
    const project = await createOk(ana.cookies, ws.id, { name: 'Proyecto' });
    await db.project.update({ where: { id: project.id }, data: auditSoftDelete(ana.user.id) });

    const response = await update(ana.cookies, ws.id, project.id, { name: 'Cambiado' });

    expect(response.statusCode).toBe(404);
  });
});

describe('datos del proyecto (HU-31) con personas del catálogo (HU-36)', () => {
  /** Personas del catálogo del espacio, sin cuenta; devuelve sus IDs por nombre */
  async function catalog(workspaceId: string, names: string[]) {
    const people = await Promise.all(
      names.map((name) => db.person.create({ data: { workspaceId, name, ...auditCreate(null) } })),
    );
    return Object.fromEntries(people.map((person) => [person.name, person.id]));
  }

  it('guarda folio, descripción, personas y observaciones', async () => {
    const { ana, ws } = await setup();
    const id = await catalog(ws.id, [
      'Laura Méndez',
      'Equipo web',
      'Carlos Ruiz',
      'Patricia Gómez',
    ]);

    const project = await createOk(ana.cookies, ws.id, {
      name: 'Portal',
      folio: '  SOL-2026-0042 ',
      description: 'Portal para que los clientes consulten sus pedidos',
      requesterId: id['Laura Méndez'],
      assignedToId: id['Equipo web'],
      projectManagerId: id['Carlos Ruiz'],
      consultingManagerId: id['Patricia Gómez'],
      businessPartnerId: id['Laura Méndez'],
      notes: 'Arranca cuando se firme el contrato',
    });

    expect(project).toMatchObject({
      folio: 'SOL-2026-0042',
      requester: { name: 'Laura Méndez', userId: null },
      assignedTo: { name: 'Equipo web' },
      projectManager: { name: 'Carlos Ruiz' },
      consultingManager: { name: 'Patricia Gómez' },
      businessPartner: { name: 'Laura Méndez' },
      notes: 'Arranca cuando se firme el contrato',
    });
  });

  it('todo es opcional y se puede vaciar al editar', async () => {
    const { ana, ws } = await setup();
    const id = await catalog(ws.id, ['Carlos Ruiz']);
    const project = await createOk(ana.cookies, ws.id, {
      name: 'Portal',
      folio: 'SOL-1',
      projectManagerId: id['Carlos Ruiz'],
    });

    const response = await update(ana.cookies, ws.id, project.id, {
      name: 'Portal',
      folio: '',
      projectManagerId: '',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ folio: null, projectManager: null, requester: null });
  });

  it('una persona de otro espacio da 400; una archivada se conserva al editar', async () => {
    const { ana, ws } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const foreign = await catalog(other.id, ['Ajena']);
    const id = await catalog(ws.id, ['Carlos Ruiz']);
    const project = await createOk(ana.cookies, ws.id, {
      name: 'Portal',
      projectManagerId: id['Carlos Ruiz'],
    });
    await db.person.update({ where: { id: id['Carlos Ruiz']! }, data: { archivedAt: new Date() } });

    const fromOther = await create(ana.cookies, ws.id, {
      name: 'X',
      requesterId: foreign['Ajena'],
    });
    const kept = await update(ana.cookies, ws.id, project.id, {
      name: 'Portal 2',
      projectManagerId: id['Carlos Ruiz'],
    });
    const fresh = await create(ana.cookies, ws.id, {
      name: 'Y',
      projectManagerId: id['Carlos Ruiz'],
    });

    expect(fromOther.statusCode).toBe(400);
    expect(kept.statusCode).toBe(200);
    expect(fresh.statusCode).toBe(400);
  });

  it('rechaza un folio de más de 40 caracteres (400)', async () => {
    const { ana, ws } = await setup();
    const response = await create(ana.cookies, ws.id, { name: 'X', folio: 'F'.repeat(41) });
    expect(response.statusCode).toBe(400);
  });
});

describe('sprint del proyecto (HU-33)', () => {
  it('guarda Sprint y Actividades del sprint, y se pueden vaciar', async () => {
    const { ana, ws } = await setup();
    const project = await createOk(ana.cookies, ws.id, {
      name: 'ERP',
      sprint: ' Sprint 4 ',
      sprintActivities: 'Cerrar incidencias de facturación',
    });

    const cleared = await update(ana.cookies, ws.id, project.id, { name: 'ERP', sprint: '' });

    expect(project).toMatchObject({
      sprint: 'Sprint 4',
      sprintActivities: 'Cerrar incidencias de facturación',
    });
    expect(cleared.json()).toMatchObject({ sprint: null, sprintActivities: null });
  });

  it('rechaza un Sprint de más de 60 caracteres (400)', async () => {
    const { ana, ws } = await setup();
    const response = await create(ana.cookies, ws.id, { name: 'X', sprint: 'S'.repeat(61) });
    expect(response.statusCode).toBe(400);
  });
});

describe('folios automáticos (HU-38)', () => {
  async function typeId(workspaceId: string, name: string) {
    const type = await db.projectType.findFirstOrThrow({ where: { workspaceId, name } });
    return type.id;
  }

  function createOn(cookies: Cookies, workspaceId: string, today: string, payload: object) {
    return app.inject({
      method: 'POST',
      url: `${url(workspaceId)}?today=${today}`,
      cookies,
      payload,
    });
  }

  it('numera por prefijo y mes con la fecha del usuario; el folio manual no consume número', async () => {
    const { ana, ws } = await setup();
    const mtto = await typeId(ws.id, 'Mtto correctivo');
    const evolutivo = await typeId(ws.id, 'Mtto evolutivo');
    const folios: (string | null)[] = [];
    for (const payload of [
      { name: 'A', typeId: mtto },
      { name: 'B', typeId: mtto, folio: 'SOL-99' },
      { name: 'C', typeId: evolutivo },
      { name: 'D' },
    ]) {
      const response = await createOn(ana.cookies, ws.id, '2026-10-28', payload);
      folios.push(projectSchema.parse(response.json()).folio);
    }
    const nextMonth = await createOn(ana.cookies, ws.id, '2026-11-01', { name: 'E', typeId: mtto });

    expect(folios).toEqual(['MT2610-001', 'SOL-99', 'MT2610-002', 'PY2610-001']);
    expect(projectSchema.parse(nextMonth.json()).folio).toBe('MT2611-001');
  });

  it('cada espacio lleva su propia numeración', async () => {
    const { ana, ws } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });

    const first = await createOn(ana.cookies, ws.id, '2026-10-28', { name: 'A' });
    const second = await createOn(ana.cookies, other.id, '2026-10-28', { name: 'B' });

    expect(projectSchema.parse(first.json()).folio).toBe('PY2610-001');
    expect(projectSchema.parse(second.json()).folio).toBe('PY2610-001');
  });

  it('al editar, vaciar el folio lo deja vacío (no se genera otro)', async () => {
    const { ana, ws } = await setup();
    const project = await createOk(ana.cookies, ws.id, { name: 'A' });

    const response = await update(ana.cookies, ws.id, project.id, { name: 'A', folio: '' });

    expect(response.json()).toMatchObject({ folio: null });
  });
});

describe('folio sin duplicados y formato que se completa (HU-38)', () => {
  function createOn(cookies: Cookies, workspaceId: string, payload: object) {
    return app.inject({
      method: 'POST',
      url: `${url(workspaceId)}?today=2026-10-28`,
      cookies,
      payload,
    });
  }

  it('un folio repetido en el espacio da 409 (sin distinguir mayúsculas, papelera incluida)', async () => {
    const { ana, ws } = await setup();
    const first = await createOk(ana.cookies, ws.id, { name: 'A', folio: 'SOL-1' });
    await db.project.update({ where: { id: first.id }, data: auditSoftDelete(ana.user.id) });

    const response = await create(ana.cookies, ws.id, { name: 'B', folio: 'sol-1' });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ message: string }>().message).toContain('sol-1');
  });

  it('"Sin folio" es el único que puede repetirse y no consume número (HU-43)', async () => {
    const { ana, ws } = await setup();
    const a = await createOk(ana.cookies, ws.id, { name: 'A', folio: 'Sin folio' });
    const b = await create(ana.cookies, ws.id, { name: 'B', folio: 'SIN FOLIO' });
    const c = await createOk(ana.cookies, ws.id, { name: 'C' });

    expect(a.folio).toBe('Sin folio');
    expect(b.statusCode).toBe(201);
    expect(c.folio).toMatch(/-001$/);
    // Al editar, otro contenedor también puede pasar a "Sin folio"
    const edit = await update(ana.cookies, ws.id, c.id, { name: 'C', folio: 'Sin Folio' });
    expect(edit.statusCode).toBe(200);
  });

  it('al editar se conserva el folio propio, pero no se toma el de otro', async () => {
    const { ana, ws } = await setup();
    const a = await createOk(ana.cookies, ws.id, { name: 'A', folio: 'SOL-1' });
    await createOk(ana.cookies, ws.id, { name: 'B', folio: 'SOL-2' });

    const keep = await update(ana.cookies, ws.id, a.id, { name: 'A renombrado', folio: 'SOL-1' });
    const steal = await update(ana.cookies, ws.id, a.id, { name: 'A', folio: 'SOL-2' });

    expect(keep.statusCode).toBe(200);
    expect(steal.statusCode).toBe(409);
  });

  it('teclear solo el formato lo completa con el número vigente', async () => {
    const { ana, ws } = await setup();
    const folios: (string | null)[] = [];
    for (const folio of ['MT', 'mt2610-', 'PY2611', 'ACT']) {
      const response = await createOn(ana.cookies, ws.id, { name: folio, folio });
      folios.push(projectSchema.parse(response.json()).folio);
    }

    expect(folios).toEqual(['MT2610-001', 'MT2610-002', 'PY2611-001', 'ACT2610-001']);
  });

  it('el automático se salta un número que alguien ya tecleó a mano', async () => {
    const { ana, ws } = await setup();
    await createOn(ana.cookies, ws.id, { name: 'Manual', folio: 'PY2610-001' });

    const auto = await createOn(ana.cookies, ws.id, { name: 'Auto' });

    expect(projectSchema.parse(auto.json()).folio).toBe('PY2610-002');
  });
});
