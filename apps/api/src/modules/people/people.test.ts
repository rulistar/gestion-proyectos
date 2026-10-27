import { memberListSchema, personListSchema, personSchema, taskSchema } from '@gestion/shared';
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
      payload: { title: 'T', assigneeId: ana.user.id },
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
    expect(taskSchema.array().parse(tasks.json())[0]?.assigneeName).toBe('Rodrigo');
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
