import { projectListSchema, projectSchema, type MembershipRole } from '@gestion/shared';
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
      folio: null,
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
    const task = (status: 'PENDING' | 'DONE', estimatedMinutes: number, deleted = false) =>
      db.task.create({
        data: {
          workspaceId: ws.id,
          projectId: project.id,
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

describe('datos del proyecto (HU-31)', () => {
  const details = {
    folio: '  SOL-2026-0042 ',
    description: 'Portal para que los clientes consulten sus pedidos',
    requester: 'Laura Méndez',
    assignedTo: 'Equipo web',
    projectManager: 'Carlos Ruiz',
    consultingManager: 'Patricia Gómez',
    businessPartner: 'Distribuidora del Norte',
    notes: 'Arranca cuando se firme el contrato',
  };

  it('guarda folio, descripción, personas y observaciones (recortados)', async () => {
    const { ana, ws } = await setup();

    const project = await createOk(ana.cookies, ws.id, { name: 'Portal', ...details });

    expect(project).toMatchObject({ ...details, folio: 'SOL-2026-0042' });
  });

  it('todo es opcional y se puede vaciar al editar; el folio puede repetirse', async () => {
    const { ana, ws } = await setup();
    const project = await createOk(ana.cookies, ws.id, { name: 'Portal', ...details });
    await createOk(ana.cookies, ws.id, { name: 'Otro', folio: 'SOL-2026-0042' });

    const response = await update(ana.cookies, ws.id, project.id, {
      name: 'Portal',
      folio: '',
      projectManager: '',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ folio: null, projectManager: null, requester: null });
  });

  it('rechaza un folio de más de 40 caracteres (400)', async () => {
    const { ana, ws } = await setup();
    const response = await create(ana.cookies, ws.id, { name: 'X', folio: 'F'.repeat(41) });
    expect(response.statusCode).toBe(400);
  });
});
