import { personListSchema } from '@gestion/shared';
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

/** El ejemplo del PO: Ana es Admin de workpers y de Monex; Luis (sin cuenta) es de workpers */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const workpers = await createWorkspace(db, ana.user.id, { name: 'workpers' });
  const monex = await createWorkspace(db, ana.user.id, { name: 'Monex' });
  const people = (id: string) => `/api/v1/workspaces/${id}/people`;
  const created = await app.inject({
    method: 'POST',
    url: people(workpers.id),
    cookies: ana.cookies,
    payload: { name: 'Luis' },
  });
  const luisId = created.json<{ id: string }>().id;
  return { ana, workpers, monex, people, luisId };
}

function list(cookies: Cookies, url: string) {
  return app.inject({ url, cookies }).then((response) => personListSchema.parse(response.json()));
}

function share(cookies: Cookies, url: string, workspaceId: string) {
  return app.inject({ method: 'POST', url, cookies, payload: { workspaceId } });
}

describe('personas compartidas entre espacios (HU-50)', () => {
  it('compartida, aparece en el otro espacio y se puede asignar ahí', async () => {
    const { ana, workpers, monex, people, luisId } = await setup();
    const shared = await share(ana.cookies, `${people(workpers.id)}/${luisId}/shares`, monex.id);
    expect(shared.statusCode).toBe(200);

    const inMonex = (await list(ana.cookies, people(monex.id))).find((p) => p.id === luisId);
    expect(inMonex).toMatchObject({
      name: 'Luis',
      sharedFrom: { workspaceId: workpers.id, name: 'workpers' },
      sharedWith: [],
    });
    const inWorkpers = (await list(ana.cookies, people(workpers.id))).find((p) => p.id === luisId);
    expect(inWorkpers).toMatchObject({
      sharedFrom: null,
      sharedWith: [{ workspaceId: monex.id, name: 'Monex' }],
    });

    // Responsable de una tarea en Monex
    const project = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${monex.id}/projects`,
      cookies: ana.cookies,
      payload: { name: 'Portal' },
    });
    const task = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${monex.id}/projects/${project.json<{ id: string }>().id}/tasks`,
      cookies: ana.cookies,
      payload: { title: 'Diseño', responsiblePersonId: luisId },
    });
    expect(task.statusCode).toBe(201);
    expect(task.json<{ responsible: { name: string } }>().responsible.name).toBe('Luis');
  });

  it('solo se edita, fusiona o borra en su espacio dueño', async () => {
    const { ana, workpers, monex, people, luisId } = await setup();
    await share(ana.cookies, `${people(workpers.id)}/${luisId}/shares`, monex.id);
    const inMonex = `${people(monex.id)}/${luisId}`;

    const rename = await app.inject({
      method: 'PATCH',
      url: inMonex,
      cookies: ana.cookies,
      payload: { name: 'Luis P.' },
    });
    expect(rename.statusCode).toBe(404);
    const other = await app.inject({
      method: 'POST',
      url: people(monex.id),
      cookies: ana.cookies,
      payload: { name: 'Pedro' },
    });
    const merge = await app.inject({
      method: 'POST',
      url: `${inMonex}/merge`,
      cookies: ana.cookies,
      payload: { intoId: other.json<{ id: string }>().id },
    });
    expect(merge.statusCode).toBe(404);
    const remove = await app.inject({ method: 'DELETE', url: inMonex, cookies: ana.cookies });
    expect(remove.statusCode).toBe(409);

    // En su espacio sí se renombra, y el nombre nuevo se ve en Monex
    const owner = await app.inject({
      method: 'PATCH',
      url: `${people(workpers.id)}/${luisId}`,
      cookies: ana.cookies,
      payload: { name: 'Luis Pérez' },
    });
    expect(owner.statusCode).toBe(200);
    const names = (await list(ana.cookies, people(monex.id))).map((p) => p.name);
    expect(names).toContain('Luis Pérez');
  });

  it('dejar de compartir solo si ahí no está asignada a nada (papelera incluida)', async () => {
    const { ana, workpers, monex, people, luisId } = await setup();
    await share(ana.cookies, `${people(workpers.id)}/${luisId}/shares`, monex.id);
    const project = await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${monex.id}/projects`,
      cookies: ana.cookies,
      payload: { name: 'Portal', requesterId: luisId },
    });
    expect(project.statusCode).toBe(201);
    const unshare = () =>
      app.inject({
        method: 'DELETE',
        url: `${people(monex.id)}/${luisId}/share`,
        cookies: ana.cookies,
      });

    expect((await unshare()).statusCode).toBe(409);
    await db.project.deleteMany({ where: { workspaceId: monex.id } });
    expect((await unshare()).statusCode).toBe(204);
    const ids = (await list(ana.cookies, people(monex.id))).map((p) => p.id);
    expect(ids).not.toContain(luisId);
    // Sigue en su espacio
    expect((await list(ana.cookies, people(workpers.id))).map((p) => p.id)).toContain(luisId);
  });

  it('exige ser Admin en los dos espacios; choque de nombre o de cuenta da 409', async () => {
    const { ana, workpers, monex, people, luisId } = await setup();
    const url = `${people(workpers.id)}/${luisId}/shares`;

    // Ventas: Ana es Miembro, no Admin
    const beto = await userWithSession(db, 'beto@example.com');
    const ventas = await createWorkspace(db, beto.user.id, { name: 'Ventas' });
    await addMember(db, ventas.id, ana.user.id, 'MEMBER');
    expect((await share(ana.cookies, url, ventas.id)).statusCode).toBe(403);
    // Un espacio donde no está: 404
    const ajeno = await createWorkspace(db, beto.user.id, { name: 'Ajeno' });
    expect((await share(ana.cookies, url, ajeno.id)).statusCode).toBe(404);

    // Monex ya tiene otra "luis"
    await app.inject({
      method: 'POST',
      url: people(monex.id),
      cookies: ana.cookies,
      payload: { name: 'luis' },
    });
    expect((await share(ana.cookies, url, monex.id)).statusCode).toBe(409);

    // La persona de Ana (con cuenta) no se comparte con Monex: ahí ya tiene la suya
    const anaInWorkpers = (await list(ana.cookies, people(workpers.id))).find(
      (p) => p.userId === ana.user.id,
    )!;
    const own = await share(
      ana.cookies,
      `${people(workpers.id)}/${anaInWorkpers.id}/shares`,
      monex.id,
    );
    expect(own.statusCode).toBe(409);
  });

  it('un Miembro ve la persona compartida, pero no de qué espacio viene', async () => {
    const { ana, workpers, monex, people, luisId } = await setup();
    await share(ana.cookies, `${people(workpers.id)}/${luisId}/shares`, monex.id);
    const beto = await userWithSession(db, 'beto@example.com');
    await addMember(db, monex.id, beto.user.id, 'MEMBER');
    const luis = (await list(beto.cookies, people(monex.id))).find((p) => p.id === luisId);
    expect(luis).toMatchObject({ name: 'Luis', sharedFrom: null, sharedWith: [] });
  });
});
