import { taskOriginListSchema, taskSchema, type MembershipRole } from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
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

const base = (ws: string) => `/api/v1/workspaces/${ws}`;

async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  async function withRole(email: string, role: MembershipRole) {
    const user = await userWithSession(db, email);
    await addMember(db, ws.id, user.user.id, role);
    return user;
  }
  const project = await app.inject({
    method: 'POST',
    url: `${base(ws.id)}/projects`,
    cookies: ana.cookies,
    payload: { name: 'Portal' },
  });
  return { ana, ws, withRole, projectId: project.json<{ id: string }>().id };
}

async function origins(cookies: Cookies, ws: string) {
  const response = await app.inject({ url: `${base(ws)}/task-origins`, cookies });
  expect(response.statusCode).toBe(200);
  return taskOriginListSchema.parse(response.json());
}

async function originId(cookies: Cookies, ws: string, name: string) {
  return (await origins(cookies, ws)).find((origin) => origin.name === name)!.id;
}

function createTask(cookies: Cookies, ws: string, projectId: string, payload: object) {
  return app.inject({
    method: 'POST',
    url: `${base(ws)}/projects/${projectId}/tasks`,
    cookies,
    payload: { title: 'T', ...payload },
  });
}

describe('catálogo de orígenes (HU-47)', () => {
  it('un espacio nuevo trae los orígenes iniciales; cualquier miembro los ve', async () => {
    const { ws, withRole } = await setup();
    const lector = await withRole('lector@example.com', 'VIEWER');

    expect((await origins(lector.cookies, ws.id)).map((o) => o.name)).toEqual([
      'Correo',
      'Teléfono',
      'Junta',
      'Ticket',
    ]);
  });

  it('el Admin agrega, renombra y archiva; un nombre repetido da 409; un Miembro, 403', async () => {
    const { ana, ws, withRole } = await setup();
    const miembro = await withRole('miembro@example.com', 'MEMBER');
    const url = `${base(ws.id)}/task-origins`;

    const created = await app.inject({
      method: 'POST',
      url,
      cookies: ana.cookies,
      payload: { name: 'WhatsApp' },
    });
    const again = await app.inject({
      method: 'POST',
      url,
      cookies: ana.cookies,
      payload: { name: 'correo' },
    });
    const asMember = await app.inject({
      method: 'POST',
      url,
      cookies: miembro.cookies,
      payload: { name: 'X' },
    });
    const junta = await originId(ana.cookies, ws.id, 'Junta');
    const archived = await app.inject({
      method: 'PATCH',
      url: `${url}/${junta}`,
      cookies: ana.cookies,
      payload: { name: 'Reunión', archived: true },
    });

    expect(created.statusCode).toBe(201);
    expect(again.statusCode).toBe(409);
    expect(asMember.statusCode).toBe(403);
    expect(taskOriginListSchema.parse(archived.json()).find((o) => o.id === junta)).toMatchObject({
      name: 'Reunión',
      archived: true,
    });
  });
});

describe('origen de la tarea (HU-47)', () => {
  it('la tarea guarda su origen y el detalle; cuenta en el catálogo', async () => {
    const { ana, ws, projectId } = await setup();
    const ticket = await originId(ana.cookies, ws.id, 'Ticket');

    const response = await createTask(ana.cookies, ws.id, projectId, {
      originId: ticket,
      originDetail: '  Ticket #4521 de mesa de ayuda ',
    });

    expect(response.statusCode).toBe(201);
    expect(taskSchema.parse(response.json())).toMatchObject({
      origin: { id: ticket, name: 'Ticket' },
      originDetail: 'Ticket #4521 de mesa de ayuda',
    });
    expect((await origins(ana.cookies, ws.id)).find((o) => o.id === ticket)?.taskCount).toBe(1);
  });

  it('un origen de otro espacio o archivado da 400; al editar se conserva el que ya tenía', async () => {
    const { ana, ws, projectId } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const foreign = await originId(ana.cookies, other.id, 'Correo');
    const correo = await originId(ana.cookies, ws.id, 'Correo');
    const created = await createTask(ana.cookies, ws.id, projectId, { originId: correo });
    const taskId = created.json<{ id: string }>().id;
    await app.inject({
      method: 'PATCH',
      url: `${base(ws.id)}/task-origins/${correo}`,
      cookies: ana.cookies,
      payload: { archived: true },
    });

    const withForeign = await createTask(ana.cookies, ws.id, projectId, { originId: foreign });
    const withArchived = await createTask(ana.cookies, ws.id, projectId, { originId: correo });
    const keep = await app.inject({
      method: 'PUT',
      url: `${base(ws.id)}/projects/${projectId}/tasks/${taskId}`,
      cookies: ana.cookies,
      payload: { title: 'T editada', originId: correo },
    });

    expect(withForeign.statusCode).toBe(400);
    expect(withArchived.statusCode).toBe(400);
    expect(keep.statusCode).toBe(200);
  });

  it('al mover la tarea a otro espacio, su origen se busca por nombre en el destino', async () => {
    const { ana, ws, projectId } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const target = await app.inject({
      method: 'POST',
      url: `${base(other.id)}/projects`,
      cookies: ana.cookies,
      payload: { name: 'Destino' },
    });
    const targetProjectId = target.json<{ id: string }>().id;
    const created = await createTask(ana.cookies, ws.id, projectId, {
      originId: await originId(ana.cookies, ws.id, 'Ticket'),
    });

    const moved = await app.inject({
      method: 'POST',
      url: `${base(ws.id)}/projects/${projectId}/tasks/${created.json<{ id: string }>().id}/move`,
      cookies: ana.cookies,
      payload: { targetWorkspaceId: other.id, targetProjectId },
    });

    expect(moved.statusCode).toBe(204);
    const tasks = await app.inject({
      url: `${base(other.id)}/projects/${targetProjectId}/tasks`,
      cookies: ana.cookies,
    });
    expect(taskSchema.array().parse(tasks.json())[0]?.origin).toEqual({
      id: await originId(ana.cookies, other.id, 'Ticket'),
      name: 'Ticket',
    });
  });
});
