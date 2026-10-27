import {
  projectSchema,
  projectTypeListSchema,
  taskSchema,
  taskTypeListSchema,
  type MembershipRole,
} from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createWorkspace } from '../workspaces/workspaces.service.js';
import { startedAtFor } from '../tasks/tasks.service.js';

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

const base = (ws: string) => `/api/v1/workspaces/${ws}`;

async function taskTypes(cookies: Cookies, ws: string) {
  const response = await app.inject({ url: `${base(ws)}/task-types`, cookies });
  expect(response.statusCode).toBe(200);
  return taskTypeListSchema.parse(response.json());
}

async function projectTypes(cookies: Cookies, ws: string) {
  const response = await app.inject({ url: `${base(ws)}/project-types`, cookies });
  return projectTypeListSchema.parse(response.json());
}

async function idOf(cookies: Cookies, ws: string, name: string) {
  return (await taskTypes(cookies, ws)).find((t) => t.name === name)!.id;
}

async function createProject(cookies: Cookies, ws: string, typeName: string) {
  const typeId = (await projectTypes(cookies, ws)).find((t) => t.name === typeName)!.id;
  const response = await app.inject({
    method: 'POST',
    url: `${base(ws)}/projects`,
    cookies,
    payload: { name: typeName, typeId },
  });
  return projectSchema.parse(response.json());
}

function createTask(cookies: Cookies, ws: string, projectId: string, payload: object) {
  return app.inject({
    method: 'POST',
    url: `${base(ws)}/projects/${projectId}/tasks`,
    cookies,
    payload,
  });
}

describe('catálogo de tipos de tarea (HU-22)', () => {
  it('un espacio nuevo trae los tipos iniciales; Fast track es de atención inmediata', async () => {
    const { ana, ws } = await setup();
    const types = await taskTypes(ana.cookies, ws.id);
    expect(types.map((t) => t.name)).toEqual([
      'Tarea',
      'Incidencia',
      'Fast track',
      'Reunión',
      'Entregable',
      'Revisión',
      'Investigación',
      'Examen',
    ]);
    expect(types.filter((t) => t.expedited).map((t) => t.name)).toEqual(['Fast track']);
  });

  it('los mantenimientos iniciales admiten solo sus tipos; Proyecto admite todos', async () => {
    const { ana, ws } = await setup();
    const names = new Map((await taskTypes(ana.cookies, ws.id)).map((t) => [t.id, t.name]));
    const byName = new Map((await projectTypes(ana.cookies, ws.id)).map((t) => [t.name, t]));

    const allowed = (name: string) =>
      byName.get(name)!.allowedTaskTypeIds.map((id) => names.get(id));
    expect(allowed('Mtto correctivo')).toEqual(
      expect.arrayContaining(['Incidencia', 'Fast track', 'Tarea']),
    );
    expect(allowed('Mtto correctivo')).toHaveLength(3);
    expect(allowed('Proyecto')).toEqual([]);
  });

  it('el Admin agrega, renombra, marca atención inmediata y archiva; un Miembro no (403)', async () => {
    const { ana, ws, withRole } = await setup();
    const luis = await withRole('luis@example.com', 'MEMBER');

    const created = await app.inject({
      method: 'POST',
      url: `${base(ws.id)}/task-types`,
      cookies: ana.cookies,
      payload: { name: 'Urgencia de seguridad', expedited: true },
    });
    const forbidden = await app.inject({
      method: 'POST',
      url: `${base(ws.id)}/task-types`,
      cookies: luis.cookies,
      payload: { name: 'X' },
    });
    const examen = await idOf(ana.cookies, ws.id, 'Examen');
    const archived = await app.inject({
      method: 'PATCH',
      url: `${base(ws.id)}/task-types/${examen}`,
      cookies: ana.cookies,
      payload: { name: 'Evaluación', archived: true },
    });

    expect(created.statusCode).toBe(201);
    expect(taskTypeListSchema.parse(created.json()).at(-1)).toMatchObject({
      name: 'Urgencia de seguridad',
      expedited: true,
    });
    expect(forbidden.statusCode).toBe(403);
    expect(taskTypeListSchema.parse(archived.json()).find((t) => t.id === examen)).toMatchObject({
      name: 'Evaluación',
      archived: true,
    });
  });

  it('un nombre repetido da 409', async () => {
    const { ana, ws } = await setup();
    const response = await app.inject({
      method: 'POST',
      url: `${base(ws.id)}/task-types`,
      cookies: ana.cookies,
      payload: { name: 'fast TRACK' },
    });
    expect(response.statusCode).toBe(409);
  });
});

describe('tipos de tarea permitidos por tipo de contenedor (HU-22)', () => {
  it('un mantenimiento correctivo rechaza una Reunión (400) y acepta una Incidencia', async () => {
    const { ana, ws } = await setup();
    const mtto = await createProject(ana.cookies, ws.id, 'Mtto correctivo');

    const meeting = await createTask(ana.cookies, ws.id, mtto.id, {
      title: 'Junta',
      typeId: await idOf(ana.cookies, ws.id, 'Reunión'),
    });
    const incident = await createTask(ana.cookies, ws.id, mtto.id, {
      title: 'Falla',
      typeId: await idOf(ana.cookies, ws.id, 'Incidencia'),
    });
    // Sin tipo: el primero permitido en el orden del catálogo
    const fallback = await createTask(ana.cookies, ws.id, mtto.id, { title: 'Sin tipo' });

    expect(meeting.statusCode).toBe(400);
    expect(incident.statusCode).toBe(201);
    expect(taskSchema.parse(fallback.json()).type.name).toBe('Tarea');
  });

  it('el Admin cambia los permitidos; vacío = todos; un tipo de otro espacio da 400', async () => {
    const { ana, ws } = await setup();
    const proyecto = (await projectTypes(ana.cookies, ws.id)).find((t) => t.name === 'Proyecto')!;
    const reunion = await idOf(ana.cookies, ws.id, 'Reunión');
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const foreign = await idOf(ana.cookies, other.id, 'Tarea');
    const patch = (allowedTaskTypeIds: string[]) =>
      app.inject({
        method: 'PATCH',
        url: `${base(ws.id)}/project-types/${proyecto.id}`,
        cookies: ana.cookies,
        payload: { allowedTaskTypeIds },
      });

    const limited = await patch([reunion]);
    const invalid = await patch([foreign]);

    expect(
      projectTypeListSchema.parse(limited.json()).find((t) => t.id === proyecto.id)
        ?.allowedTaskTypeIds,
    ).toEqual([reunion]);
    expect(invalid.statusCode).toBe(400);
    const project = await createProject(ana.cookies, ws.id, 'Proyecto');
    const task = await createTask(ana.cookies, ws.id, project.id, { title: 'X' });
    expect(taskSchema.parse(task.json()).type.name).toBe('Reunión');
  });

  it('no se cambia el tipo del contenedor si tiene tareas de tipos que el nuevo no admite (409)', async () => {
    const { ana, ws } = await setup();
    const project = await createProject(ana.cookies, ws.id, 'Proyecto');
    await createTask(ana.cookies, ws.id, project.id, {
      title: 'Junta',
      typeId: await idOf(ana.cookies, ws.id, 'Reunión'),
    });
    const correctivo = (await projectTypes(ana.cookies, ws.id)).find(
      (t) => t.name === 'Mtto correctivo',
    )!;

    const response = await app.inject({
      method: 'PUT',
      url: `${base(ws.id)}/projects/${project.id}`,
      cookies: ana.cookies,
      payload: { name: 'Proyecto', typeId: correctivo.id },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ message: string }>().message).toContain('Reunión');
  });
});

describe('inicio real de la tarea (ADR-0004 §2.1)', () => {
  const t1 = new Date('2026-10-01T10:00:00Z');

  it('se registra la primera vez que pasa a En curso o a Hecha y no se borra', () => {
    expect(startedAtFor('PENDING', null, t1)).toBeNull();
    expect(startedAtFor('IN_PROGRESS', null, t1)).toEqual(t1);
    expect(startedAtFor('DONE', null, t1)).toEqual(t1);
    expect(startedAtFor('PENDING', t1, new Date())).toEqual(t1);
  });

  it('la API lo guarda al mover la tarea', async () => {
    const { ana, ws } = await setup();
    const project = await createProject(ana.cookies, ws.id, 'Proyecto');
    const task = taskSchema.parse(
      (await createTask(ana.cookies, ws.id, project.id, { title: 'X' })).json(),
    );

    const moved = await app.inject({
      method: 'PATCH',
      url: `${base(ws.id)}/projects/${project.id}/tasks/${task.id}/status`,
      cookies: ana.cookies,
      payload: { status: 'IN_PROGRESS' },
    });

    expect(task.startedAt).toBeNull();
    expect(taskSchema.parse(moved.json()).startedAt).not.toBeNull();
  });
});

describe('tipos de tarea por contenedor (HU-37)', () => {
  async function mttoCorrectivo(cookies: Cookies, ws: string, payload: object = {}) {
    const typeId = (await projectTypes(cookies, ws)).find((t) => t.name === 'Mtto correctivo')!.id;
    const response = await app.inject({
      method: 'POST',
      url: `${base(ws)}/projects`,
      cookies,
      payload: { name: 'Mtto', typeId, ...payload },
    });
    return response;
  }

  function editProject(cookies: Cookies, ws: string, projectId: string, payload: object) {
    return app.inject({
      method: 'PUT',
      url: `${base(ws)}/projects/${projectId}`,
      cookies,
      payload: { name: 'Mtto', ...payload },
    });
  }

  it('dos mantenimientos del mismo tipo limitan sus tipos de forma distinta', async () => {
    const { ana, ws } = await setup();
    const incidencia = await idOf(ana.cookies, ws.id, 'Incidencia');
    const fast = await idOf(ana.cookies, ws.id, 'Fast track');
    const tarea = await idOf(ana.cookies, ws.id, 'Tarea');

    const a = projectSchema.parse(
      (await mttoCorrectivo(ana.cookies, ws.id, { taskTypeIds: [incidencia, fast, tarea] })).json(),
    );
    const b = projectSchema.parse(
      (await mttoCorrectivo(ana.cookies, ws.id, { taskTypeIds: `${incidencia},${fast}` })).json(),
    );
    const taskInB = await createTask(ana.cookies, ws.id, b.id, { title: 'X', typeId: tarea });
    const fallbackB = await createTask(ana.cookies, ws.id, b.id, { title: 'Sin tipo' });

    expect(a.allowedTaskTypeIds).toHaveLength(3);
    expect(b.allowedTaskTypeIds.sort()).toEqual([incidencia, fast].sort());
    expect(taskInB.statusCode).toBe(400);
    expect(taskSchema.parse(fallbackB.json()).type.name).toBe('Incidencia');
  });

  it('solo se eligen tipos que admite su tipo de contenedor (400)', async () => {
    const { ana, ws } = await setup();
    const reunion = await idOf(ana.cookies, ws.id, 'Reunión');

    const response = await mttoCorrectivo(ana.cookies, ws.id, { taskTypeIds: [reunion] });

    expect(response.statusCode).toBe(400);
  });

  it('no se quita un tipo que ya usan sus tareas (409); sin enviar la lista, no cambia', async () => {
    const { ana, ws } = await setup();
    const incidencia = await idOf(ana.cookies, ws.id, 'Incidencia');
    const fast = await idOf(ana.cookies, ws.id, 'Fast track');
    const mtto = projectSchema.parse(
      (await mttoCorrectivo(ana.cookies, ws.id, { taskTypeIds: [incidencia, fast] })).json(),
    );
    await createTask(ana.cookies, ws.id, mtto.id, { title: 'Falla', typeId: incidencia });

    const removeUsed = await editProject(ana.cookies, ws.id, mtto.id, { taskTypeIds: [fast] });
    const untouched = await editProject(ana.cookies, ws.id, mtto.id, {
      notes: 'Sin cambiar tipos',
    });
    const cleared = await editProject(ana.cookies, ws.id, mtto.id, { taskTypeIds: '' });

    expect(removeUsed.statusCode).toBe(409);
    expect(projectSchema.parse(untouched.json()).allowedTaskTypeIds).toHaveLength(2);
    expect(projectSchema.parse(cleared.json()).allowedTaskTypeIds).toEqual([]);
  });

  it('al cambiar a un tipo que no admite la lista propia, la lista se descarta', async () => {
    const { ana, ws } = await setup();
    const incidencia = await idOf(ana.cookies, ws.id, 'Incidencia');
    const mtto = projectSchema.parse(
      (await mttoCorrectivo(ana.cookies, ws.id, { taskTypeIds: [incidencia] })).json(),
    );
    const evolutivo = (await projectTypes(ana.cookies, ws.id)).find(
      (t) => t.name === 'Mtto evolutivo',
    )!;

    const moved = await editProject(ana.cookies, ws.id, mtto.id, { typeId: evolutivo.id });

    expect(moved.statusCode).toBe(200);
    expect(projectSchema.parse(moved.json()).allowedTaskTypeIds).toEqual([]);
  });
});
