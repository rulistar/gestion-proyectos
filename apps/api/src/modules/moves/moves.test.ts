import { projectSchema, taskListSchema, type MembershipRole } from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { auditCreate } from '../../db/audit.js';
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

/** Ana es Admin de dos espacios (origen y destino) */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const source = await createWorkspace(db, ana.user.id, { name: 'Origen' });
  const target = await createWorkspace(db, ana.user.id, { name: 'Destino' });
  async function withRole(workspaceId: string, email: string, role: MembershipRole) {
    const user = await userWithSession(db, email);
    await addMember(db, workspaceId, user.user.id, role);
    return user;
  }
  return { ana, source, target, withRole };
}

const base = (ws: string) => `/api/v1/workspaces/${ws}`;

async function typeId(workspaceId: string, name: string) {
  return (await db.projectType.findFirstOrThrow({ where: { workspaceId, name } })).id;
}

async function taskTypeId(workspaceId: string, name: string) {
  return (await db.taskType.findFirstOrThrow({ where: { workspaceId, name } })).id;
}

async function personOf(workspaceId: string, userId: string) {
  return (await db.person.findFirstOrThrow({ where: { workspaceId, userId } })).id;
}

async function createProject(cookies: Cookies, ws: string, payload: object) {
  const response = await app.inject({
    method: 'POST',
    url: `${base(ws)}/projects`,
    cookies,
    payload: { name: 'Portal', ...payload },
  });
  expect(response.statusCode).toBe(201);
  return projectSchema.parse(response.json());
}

async function createTask(cookies: Cookies, ws: string, projectId: string, payload: object) {
  const response = await app.inject({
    method: 'POST',
    url: `${base(ws)}/projects/${projectId}/tasks`,
    cookies,
    payload,
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>();
}

function moveProject(cookies: Cookies, ws: string, projectId: string, payload: object) {
  return app.inject({
    method: 'POST',
    url: `${base(ws)}/projects/${projectId}/move`,
    cookies,
    payload,
  });
}

describe('mover un contenedor a otro espacio (HU-32)', () => {
  it('pasa con sus tareas, conserva IDs y folio, y traduce personas y tipos al destino', async () => {
    const { ana, source, target } = await setup();
    const laura = await db.person.create({
      data: { workspaceId: source.id, name: 'Laura', ...auditCreate(null) },
    });
    const project = await createProject(ana.cookies, source.id, {
      folio: 'SOL-7',
      requesterId: laura.id,
      projectManagerId: laura.id,
    });
    const task = await createTask(ana.cookies, source.id, project.id, {
      title: 'Revisar',
      typeId: await taskTypeId(source.id, 'Seguimiento'),
      responsiblePersonId: await personOf(source.id, ana.user.id),
    });
    // Un tipo de tarea que el destino no tiene: se crea allá
    const custom = await db.taskType.create({
      data: { workspaceId: source.id, name: 'Auditoría', ...auditCreate(null) },
    });
    await createTask(ana.cookies, source.id, project.id, { title: 'Auditar', typeId: custom.id });

    const response = await moveProject(ana.cookies, source.id, project.id, {
      targetWorkspaceId: target.id,
      typeId: await typeId(target.id, 'Proyecto'),
    });

    expect(response.statusCode).toBe(204);
    const moved = projectSchema.parse(
      (
        await app.inject({ url: `${base(target.id)}/projects/${project.id}`, cookies: ana.cookies })
      ).json(),
    );
    expect(moved).toMatchObject({ id: project.id, workspaceId: target.id, folio: 'SOL-7' });
    expect(moved.requester?.id).not.toBe(laura.id);
    expect(moved.requester).toMatchObject({ name: 'Laura' });
    // La misma persona en dos campos queda como una sola persona en el destino
    expect(moved.projectManager?.id).toBe(moved.requester?.id);
    const tasks = taskListSchema.parse(
      (
        await app.inject({
          url: `${base(target.id)}/projects/${project.id}/tasks`,
          cookies: ana.cookies,
        })
      ).json(),
    );
    const revisar = tasks.find((t) => t.id === task.id)!;
    expect(revisar.type.id).toBe(await taskTypeId(target.id, 'Seguimiento'));
    expect(revisar.responsible?.id).toBe(await personOf(target.id, ana.user.id));
    expect(tasks.find((t) => t.title === 'Auditar')?.type.name).toBe('Auditoría');
    const gone = await app.inject({
      url: `${base(source.id)}/projects/${project.id}`,
      cookies: ana.cookies,
    });
    expect(gone.statusCode).toBe(404);
  });

  it('un Miembro del origen no puede mover (403); sin acceso al destino da 404', async () => {
    const { ana, source, target, withRole } = await setup();
    const luis = await withRole(source.id, 'luis@example.com', 'MEMBER');
    const outsiderWs = await createWorkspace(db, luis.user.id, { name: 'De Luis' });
    const project = await createProject(ana.cookies, source.id, {});

    const asMember = await moveProject(luis.cookies, source.id, project.id, {
      targetWorkspaceId: target.id,
      typeId: await typeId(target.id, 'Proyecto'),
    });
    const toForeign = await moveProject(ana.cookies, source.id, project.id, {
      targetWorkspaceId: outsiderWs.id,
      typeId: await typeId(outsiderWs.id, 'Proyecto'),
    });

    expect(asMember.statusCode).toBe(403);
    expect(toForeign.statusCode).toBe(404);
  });

  it('siendo solo Miembro del destino, no puede mover allá (403)', async () => {
    const { ana, source } = await setup();
    const luis = await userWithSession(db, 'luis@example.com');
    const luisWs = await createWorkspace(db, luis.user.id, { name: 'De Luis' });
    await addMember(db, luisWs.id, ana.user.id, 'MEMBER');
    const project = await createProject(ana.cookies, source.id, {});

    const response = await moveProject(ana.cookies, source.id, project.id, {
      targetWorkspaceId: luisWs.id,
      typeId: await typeId(luisWs.id, 'Proyecto'),
    });

    expect(response.statusCode).toBe(403);
  });

  it('folio repetido en el destino (409) o tipo que no admite sus tareas (409): no se mueve nada', async () => {
    const { ana, source, target } = await setup();
    await createProject(ana.cookies, target.id, { folio: 'SOL-7' });
    const withFolio = await createProject(ana.cookies, source.id, { folio: 'sol-7' });
    const withMeeting = await createProject(ana.cookies, source.id, { name: 'Con reunión' });
    await createTask(ana.cookies, source.id, withMeeting.id, {
      title: 'Junta',
      typeId: await taskTypeId(source.id, 'Reunión'),
    });

    const folio = await moveProject(ana.cookies, source.id, withFolio.id, {
      targetWorkspaceId: target.id,
      typeId: await typeId(target.id, 'Proyecto'),
    });
    const disallowed = await moveProject(ana.cookies, source.id, withMeeting.id, {
      targetWorkspaceId: target.id,
      typeId: await typeId(target.id, 'Mtto correctivo'),
    });

    expect(folio.statusCode).toBe(409);
    expect(disallowed.statusCode).toBe(409);
    expect(disallowed.json<{ message: string }>().message).toContain('Reunión');
    expect(await db.project.count({ where: { workspaceId: source.id } })).toBe(2);
  });

  it('un tipo de otro espacio o archivado da 400', async () => {
    const { ana, source, target } = await setup();
    const project = await createProject(ana.cookies, source.id, {});

    const response = await moveProject(ana.cookies, source.id, project.id, {
      targetWorkspaceId: target.id,
      typeId: await typeId(source.id, 'Proyecto'),
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('mover una tarea (HU-32)', () => {
  function moveTask(
    cookies: Cookies,
    ws: string,
    projectId: string,
    taskId: string,
    payload: object,
  ) {
    return app.inject({
      method: 'POST',
      url: `${base(ws)}/projects/${projectId}/tasks/${taskId}/move`,
      cookies,
      payload,
    });
  }

  it('un Miembro la mueve a otro proyecto del mismo espacio', async () => {
    const { ana, source, withRole } = await setup();
    const luis = await withRole(source.id, 'luis@example.com', 'MEMBER');
    const from = await createProject(ana.cookies, source.id, { name: 'A' });
    const to = await createProject(ana.cookies, source.id, { name: 'B' });
    const task = await createTask(ana.cookies, source.id, from.id, { title: 'T' });

    const response = await moveTask(luis.cookies, source.id, from.id, task.id, {
      targetWorkspaceId: source.id,
      targetProjectId: to.id,
    });

    expect(response.statusCode).toBe(204);
    expect((await db.task.findUniqueOrThrow({ where: { id: task.id } })).projectId).toBe(to.id);
  });

  it('a otro espacio: el Admin de ambos la mueve; un Miembro no (403)', async () => {
    const { ana, source, target, withRole } = await setup();
    const luis = await withRole(source.id, 'luis@example.com', 'MEMBER');
    const from = await createProject(ana.cookies, source.id, { name: 'A' });
    const to = await createProject(ana.cookies, target.id, { name: 'B' });
    const task = await createTask(ana.cookies, source.id, from.id, { title: 'T' });
    const payload = { targetWorkspaceId: target.id, targetProjectId: to.id };

    const asMember = await moveTask(luis.cookies, source.id, from.id, task.id, payload);
    const asAdmin = await moveTask(ana.cookies, source.id, from.id, task.id, payload);

    expect(asMember.statusCode).toBe(403);
    expect(asAdmin.statusCode).toBe(204);
    expect(await db.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      workspaceId: target.id,
      projectId: to.id,
      typeId: await taskTypeId(target.id, 'Tarea'),
    });
  });

  it('el proyecto destino no admite su tipo (409)', async () => {
    const { ana, source } = await setup();
    const from = await createProject(ana.cookies, source.id, { name: 'A' });
    const to = await createProject(ana.cookies, source.id, {
      name: 'Mtto',
      typeId: await typeId(source.id, 'Mtto correctivo'),
    });
    const task = await createTask(ana.cookies, source.id, from.id, {
      title: 'Junta',
      typeId: await taskTypeId(source.id, 'Reunión'),
    });

    const response = await moveTask(ana.cookies, source.id, from.id, task.id, {
      targetWorkspaceId: source.id,
      targetProjectId: to.id,
    });

    expect(response.statusCode).toBe(409);
  });
});
