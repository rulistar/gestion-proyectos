import {
  memberListSchema,
  mergePersonResultSchema,
  personListSchema,
  personSchema,
  personUsageSchema,
  taskSchema,
} from '@gestion/shared';
import { randomUUID } from 'node:crypto';
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

/** Ana crea el espacio (recibe su persona); Luis es Miembro agregado a mano (sin persona) */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const luis = await userWithSession(db, 'luis@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  await addMember(db, ws.id, luis.user.id, 'MEMBER');
  return { ana, luis, ws };
}

const peopleUrl = (ws: string) => `/api/v1/workspaces/${ws}/people`;

async function people(cookies: Cookies, ws: string) {
  const response = await app.inject({ url: peopleUrl(ws), cookies });
  expect(response.statusCode).toBe(200);
  return personListSchema.parse(response.json());
}

function addPerson(cookies: Cookies, ws: string, name: string) {
  return app.inject({ method: 'POST', url: peopleUrl(ws), cookies, payload: { name } });
}

function patchPerson(cookies: Cookies, ws: string, personId: string, payload: object) {
  return app.inject({ method: 'PATCH', url: `${peopleUrl(ws)}/${personId}`, cookies, payload });
}

function deletePerson(cookies: Cookies, ws: string, personId: string) {
  return app.inject({ method: 'DELETE', url: `${peopleUrl(ws)}/${personId}`, cookies });
}

describe('catálogo de personas (HU-34)', () => {
  it('quien crea el espacio recibe su persona vinculada, con el nombre de su cuenta', async () => {
    const { ana, ws } = await setup();
    expect(await people(ana.cookies, ws.id)).toEqual([
      {
        id: expect.any(String) as string,
        name: 'ana@example.com',
        userId: ana.user.id,
        userName: 'ana@example.com',
        hasAccess: true,
        archived: false,
        taskCount: 0,
        projectCount: 0,
      },
    ]);
  });

  it('se da de alta una persona sin cuenta; un nombre repetido da 409', async () => {
    const { ana, luis, ws } = await setup();

    const created = await addPerson(luis.cookies, ws.id, 'Laura Méndez');
    const again = await addPerson(ana.cookies, ws.id, 'laura méndez');

    expect(created.statusCode).toBe(201);
    expect(personSchema.parse(created.json())).toMatchObject({
      name: 'Laura Méndez',
      userId: null,
      hasAccess: false,
    });
    expect(again.statusCode).toBe(409);
  });

  it('un Lector no da de alta personas; un Miembro no las administra (403)', async () => {
    const { ana, luis, ws } = await setup();
    const lector = await userWithSession(db, 'lector@example.com');
    await addMember(db, ws.id, lector.user.id, 'VIEWER');
    const [anaPerson] = await people(ana.cookies, ws.id);

    expect((await addPerson(lector.cookies, ws.id, 'X')).statusCode).toBe(403);
    expect((await patchPerson(luis.cookies, ws.id, anaPerson!.id, { name: 'Y' })).statusCode).toBe(
      403,
    );
  });

  it('alias: renombrar la persona cambia el nombre que se ve en miembros y tareas', async () => {
    const { ana, ws } = await setup();
    const [anaPerson] = await people(ana.cookies, ws.id);
    const project = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects`,
      cookies: ana.cookies,
      payload: { name: 'P' },
    });
    const projectId = project.json<{ id: string }>().id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/projects/${projectId}/tasks`,
      cookies: ana.cookies,
      payload: { title: 'T', responsiblePersonId: anaPerson!.id },
    });

    await patchPerson(ana.cookies, ws.id, anaPerson!.id, { name: 'Rodrigo' });

    const members = memberListSchema.parse(
      (
        await app.inject({ url: `/api/v1/workspaces/${ws.id}/members`, cookies: ana.cookies })
      ).json(),
    );
    const tasks = await app.inject({
      url: `/api/v1/workspaces/${ws.id}/projects/${projectId}/tasks`,
      cookies: ana.cookies,
    });
    expect(members.find((m) => m.userId === ana.user.id)?.name).toBe('Rodrigo');
    expect(taskSchema.array().parse(tasks.json())[0]?.responsible?.name).toBe('Rodrigo');
  });

  it('vincular: solo a miembros, y un usuario a una sola persona', async () => {
    const { ana, luis, ws } = await setup();
    const laura = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Laura')).json());
    const extraño = await userWithSession(db, 'extrano@example.com');

    const linked = await patchPerson(ana.cookies, ws.id, laura.id, { userId: luis.user.id });
    const outsider = await patchPerson(ana.cookies, ws.id, laura.id, { userId: extraño.user.id });
    const [anaPerson] = (await people(ana.cookies, ws.id)).filter((p) => p.userId === ana.user.id);
    const twice = await patchPerson(ana.cookies, ws.id, anaPerson!.id, { userId: luis.user.id });

    expect(personListSchema.parse(linked.json()).find((p) => p.id === laura.id)).toMatchObject({
      userId: luis.user.id,
      hasAccess: true,
    });
    expect(outsider.statusCode).toBe(400);
    expect(twice.statusCode).toBe(409);
  });

  it('quitar a un miembro no borra su persona: queda sin acceso', async () => {
    const { ana, luis, ws } = await setup();
    const laura = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Laura')).json());
    await patchPerson(ana.cookies, ws.id, laura.id, { userId: luis.user.id });

    await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${ws.id}/members/${luis.user.id}`,
      cookies: ana.cookies,
    });

    expect((await people(ana.cookies, ws.id)).find((p) => p.id === laura.id)).toMatchObject({
      name: 'Laura',
      hasAccess: false,
    });
  });

  it('archivar y reactivar; una persona de otro espacio da 404', async () => {
    const { ana, ws } = await setup();
    const laura = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Laura')).json());
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });

    const archived = await patchPerson(ana.cookies, ws.id, laura.id, { archived: true });
    const foreign = await patchPerson(ana.cookies, other.id, laura.id, { name: 'Z' });

    expect(personListSchema.parse(archived.json()).find((p) => p.id === laura.id)?.archived).toBe(
      true,
    );
    expect(foreign.statusCode).toBe(404);
  });

  it('al aceptar una invitación, el nuevo miembro recibe su persona', async () => {
    const { ana, ws } = await setup();
    const invitation = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${ws.id}/invitations`,
      cookies: ana.cookies,
      payload: { email: 'nuevo@example.com', role: 'MEMBER' },
    });
    const { token } = invitation.json<{ token: string }>();

    await app.inject({
      method: 'POST',
      url: '/api/v1/invitations/register',
      payload: { token, name: 'Nuevo Miembro', password: randomUUID() },
    });

    expect((await people(ana.cookies, ws.id)).map((p) => p.name)).toContain('Nuevo Miembro');
  });
});

describe('borrar definitivamente (HU-44)', () => {
  it('una persona archivada y sin uso se borra; activa o de otro espacio, no', async () => {
    const { ana, luis, ws } = await setup();
    const laura = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Laura')).json());
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });

    expect((await deletePerson(ana.cookies, ws.id, laura.id)).statusCode).toBe(409);
    await patchPerson(ana.cookies, ws.id, laura.id, { archived: true });
    expect((await deletePerson(luis.cookies, ws.id, laura.id)).statusCode).toBe(403);
    expect((await deletePerson(ana.cookies, other.id, laura.id)).statusCode).toBe(404);

    expect((await deletePerson(ana.cookies, ws.id, laura.id)).statusCode).toBe(204);
    expect((await people(ana.cookies, ws.id)).map((p) => p.name)).not.toContain('Laura');
  });

  it('no se borra si es Responsable de una tarea, aunque esté en la papelera, ni si tiene rol en un proyecto', async () => {
    const { ana, ws } = await setup();
    const laura = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Laura')).json());
    const pedro = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Pedro')).json());
    const projectsUrl = `/api/v1/workspaces/${ws.id}/projects`;
    const project = await app.inject({
      method: 'POST',
      url: projectsUrl,
      cookies: ana.cookies,
      payload: { name: 'P', requesterId: pedro.id, projectManagerId: pedro.id },
    });
    const projectId = project.json<{ id: string }>().id;
    const task = await app.inject({
      method: 'POST',
      url: `${projectsUrl}/${projectId}/tasks`,
      cookies: ana.cookies,
      payload: { title: 'T', responsiblePersonId: laura.id },
    });
    await app.inject({
      method: 'DELETE',
      url: `${projectsUrl}/${projectId}/tasks/${task.json<{ id: string }>().id}`,
      cookies: ana.cookies,
    });
    for (const person of [laura, pedro]) {
      await patchPerson(ana.cookies, ws.id, person.id, { archived: true });
    }

    const list = await people(ana.cookies, ws.id);
    expect(list.find((p) => p.id === laura.id)).toMatchObject({ taskCount: 1, projectCount: 0 });
    // Solicitante y PM del mismo proyecto: cuenta una vez
    expect(list.find((p) => p.id === pedro.id)).toMatchObject({ taskCount: 0, projectCount: 1 });
    expect((await deletePerson(ana.cookies, ws.id, laura.id)).statusCode).toBe(409);
    expect((await deletePerson(ana.cookies, ws.id, pedro.id)).statusCode).toBe(409);
  });

  it('no se borra la persona de alguien que sigue siendo miembro', async () => {
    const { ana, ws } = await setup();
    const [anaPerson] = await people(ana.cookies, ws.id);
    await patchPerson(ana.cookies, ws.id, anaPerson!.id, { archived: true });

    expect((await deletePerson(ana.cookies, ws.id, anaPerson!.id)).statusCode).toBe(409);
  });
});

describe('dónde se usa (HU-45)', () => {
  it('lista sus tareas y proyectos con sus roles, papelera incluida; solo el Admin', async () => {
    const { ana, luis, ws } = await setup();
    const laura = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Laura')).json());
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const projectsUrl = `/api/v1/workspaces/${ws.id}/projects`;
    const project = await app.inject({
      method: 'POST',
      url: projectsUrl,
      cookies: ana.cookies,
      payload: { name: 'Portal', requesterId: laura.id, projectManagerId: laura.id },
    });
    const projectId = project.json<{ id: string }>().id;
    for (const title of ['Diseño', 'Pruebas']) {
      await app.inject({
        method: 'POST',
        url: `${projectsUrl}/${projectId}/tasks`,
        cookies: ana.cookies,
        payload: { title, responsiblePersonId: laura.id },
      });
    }
    const tasks = taskSchema
      .array()
      .parse(
        (
          await app.inject({ url: `${projectsUrl}/${projectId}/tasks`, cookies: ana.cookies })
        ).json(),
      );
    await app.inject({
      method: 'DELETE',
      url: `${projectsUrl}/${projectId}/tasks/${tasks.find((t) => t.title === 'Pruebas')!.id}`,
      cookies: ana.cookies,
    });
    const usageUrl = `${peopleUrl(ws.id)}/${laura.id}/usage`;

    const response = await app.inject({ url: usageUrl, cookies: ana.cookies });

    expect(response.statusCode).toBe(200);
    const usage = personUsageSchema.parse(response.json());
    expect(usage.tasks.map((t) => [t.title, t.projectName, t.deleted])).toEqual([
      ['Diseño', 'Portal', false],
      ['Pruebas', 'Portal', true],
    ]);
    expect(usage.projects).toEqual([
      {
        id: projectId,
        name: 'Portal',
        folio: expect.any(String) as string,
        roles: ['requester', 'projectManager'],
        deleted: false,
      },
    ]);
    expect((await app.inject({ url: usageUrl, cookies: luis.cookies })).statusCode).toBe(403);
    const foreign = await app.inject({
      url: `${peopleUrl(other.id)}/${laura.id}/usage`,
      cookies: ana.cookies,
    });
    expect(foreign.statusCode).toBe(404);
  });
});

function mergePerson(cookies: Cookies, ws: string, personId: string, intoId: string) {
  return app.inject({
    method: 'POST',
    url: `${peopleUrl(ws)}/${personId}/merge`,
    cookies,
    payload: { intoId },
  });
}

describe('fusionar personas (HU-51)', () => {
  it('«Raúl» (sin cuenta) en la persona de Ana: pasan sus tareas, papelera incluida, y sus roles', async () => {
    const { ana, luis, ws } = await setup();
    const raul = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Raúl')).json());
    const anaPerson = (await people(ana.cookies, ws.id)).find((p) => p.userId === ana.user.id)!;
    const projectsUrl = `/api/v1/workspaces/${ws.id}/projects`;
    const project = await app.inject({
      method: 'POST',
      url: projectsUrl,
      cookies: ana.cookies,
      payload: { name: 'Portal', requesterId: raul.id, projectManagerId: raul.id },
    });
    const projectId = project.json<{ id: string }>().id;
    const tasksUrl = `${projectsUrl}/${projectId}/tasks`;
    const ids: string[] = [];
    for (const title of ['Diseño', 'Pruebas']) {
      const task = await app.inject({
        method: 'POST',
        url: tasksUrl,
        cookies: ana.cookies,
        payload: { title, responsiblePersonId: raul.id },
      });
      ids.push(task.json<{ id: string }>().id);
    }
    await app.inject({ method: 'DELETE', url: `${tasksUrl}/${ids[1]}`, cookies: ana.cookies });
    // Luis veía el trabajo de Raúl (HU-52)
    const luisMembership = await db.membership.findFirstOrThrow({
      where: { workspaceId: ws.id, userId: luis.user.id },
    });
    await db.membershipPersonAccess.create({
      data: { membershipId: luisMembership.id, personId: raul.id, createdById: ana.user.id },
    });

    expect((await mergePerson(luis.cookies, ws.id, raul.id, anaPerson.id)).statusCode).toBe(403);
    const response = await mergePerson(ana.cookies, ws.id, raul.id, anaPerson.id);

    expect(response.statusCode).toBe(200);
    expect(mergePersonResultSchema.parse(response.json())).toEqual({ tasks: 2, projects: 1 });
    const list = await people(ana.cookies, ws.id);
    expect(list.map((p) => p.name)).not.toContain('Raúl');
    expect(list.find((p) => p.id === anaPerson.id)).toMatchObject({
      taskCount: 2,
      projectCount: 1,
    });
    const portal = await db.project.findUniqueOrThrow({ where: { id: projectId } });
    expect([portal.requesterId, portal.projectManagerId]).toEqual([anaPerson.id, anaPerson.id]);
    const watched = await db.membershipPersonAccess.findMany({
      where: { membershipId: luisMembership.id },
    });
    expect(watched.map((w) => w.personId)).toEqual([anaPerson.id]);
  });

  it('si la duplicada tiene cuenta, la cuenta pasa a la que se queda', async () => {
    const { ana, luis, ws } = await setup();
    const conCuenta = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Luis P')).json());
    await patchPerson(ana.cookies, ws.id, conCuenta.id, { userId: luis.user.id });
    const sinCuenta = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Luis')).json());

    expect((await mergePerson(ana.cookies, ws.id, conCuenta.id, sinCuenta.id)).statusCode).toBe(
      200,
    );

    const list = await people(ana.cookies, ws.id);
    expect(list.find((p) => p.id === sinCuenta.id)?.userId).toBe(luis.user.id);
    expect(list.some((p) => p.id === conCuenta.id)).toBe(false);
  });

  it('no fusiona dos con cuenta, consigo misma, con una archivada ni de otro espacio', async () => {
    const { ana, luis, ws } = await setup();
    const anaPerson = (await people(ana.cookies, ws.id)).find((p) => p.userId === ana.user.id)!;
    const luisPerson = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Luis')).json());
    await patchPerson(ana.cookies, ws.id, luisPerson.id, { userId: luis.user.id });
    const archivada = personSchema.parse((await addPerson(ana.cookies, ws.id, 'Vieja')).json());
    await patchPerson(ana.cookies, ws.id, archivada.id, { archived: true });
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });

    expect((await mergePerson(ana.cookies, ws.id, luisPerson.id, anaPerson.id)).statusCode).toBe(
      409,
    );
    expect((await mergePerson(ana.cookies, ws.id, luisPerson.id, luisPerson.id)).statusCode).toBe(
      400,
    );
    expect((await mergePerson(ana.cookies, ws.id, luisPerson.id, archivada.id)).statusCode).toBe(
      400,
    );
    expect((await mergePerson(ana.cookies, other.id, luisPerson.id, anaPerson.id)).statusCode).toBe(
      404,
    );
    expect((await people(ana.cookies, ws.id)).some((p) => p.id === luisPerson.id)).toBe(true);
  });
});
