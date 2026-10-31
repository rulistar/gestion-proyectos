import { PERMISSION_TEMPLATES, VIEW_AS_HEADER } from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createWorkspace } from './workspaces.service.js';

const db = createTestDb();
const app = buildApp({ db });

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

/**
 * Monex: Ana (Admin) creó "Portal"; Beto (Miembro con la plantilla: solo lo suyo) creó "Lab".
 * Ana ve los dos; "ver como Beto" solo muestra "Lab".
 */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const beto = await userWithSession(db, 'beto@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Monex' });
  const memberTemplate = {
    ...PERMISSION_TEMPLATES.MEMBER,
    sections: {
      ...PERMISSION_TEMPLATES.MEMBER.sections,
      WITH_END: { ...PERMISSION_TEMPLATES.MEMBER.sections.WITH_END, create: true },
    },
  };
  await addMember(db, ws.id, beto.user.id, 'MEMBER', memberTemplate);
  const base = `/api/v1/workspaces/${ws.id}`;
  for (const [who, name] of [
    [ana, 'Portal'],
    [beto, 'Lab'],
  ] as const) {
    const created = await app.inject({
      method: 'POST',
      url: `${base}/projects`,
      cookies: who.cookies,
      payload: { name },
    });
    expect(created.statusCode).toBe(201);
  }
  return { ana, beto, ws, base };
}

const asBeto = (betoId: string) => ({ [VIEW_AS_HEADER]: betoId });

describe('ver como un miembro (HU-56)', () => {
  it('el Admin ve lo que ve el miembro: sus contenedores, su rol y su matriz', async () => {
    const { ana, beto, base } = await setup();
    const mine = await app.inject({ url: `${base}/projects`, cookies: ana.cookies });
    expect(
      mine
        .json<{ name: string }[]>()
        .map((p) => p.name)
        .sort(),
    ).toEqual(['Lab', 'Portal']);

    const projects = await app.inject({
      url: `${base}/projects`,
      cookies: ana.cookies,
      headers: asBeto(beto.user.id),
    });
    expect(projects.json<{ name: string }[]>().map((p) => p.name)).toEqual(['Lab']);

    const detail = await app.inject({
      url: base,
      cookies: ana.cookies,
      headers: asBeto(beto.user.id),
    });
    expect(detail.json<{ role: string }>().role).toBe('MEMBER');

    // Lo que solo hace el Admin, Beto no lo puede ver
    const invitations = await app.inject({
      url: `${base}/invitations`,
      cookies: ana.cookies,
      headers: asBeto(beto.user.id),
    });
    expect(invitations.statusCode).toBe(403);
  });

  it('las descargas aceptan ?viewAs=', async () => {
    const { ana, beto, base } = await setup();
    const exported = await app.inject({
      url: `${base}/export.json?viewAs=${beto.user.id}`,
      cookies: ana.cookies,
    });
    expect(exported.statusCode).toBe(200);
    const names = exported.json<{ projects: { name: string }[] }>().projects.map((c) => c.name);
    expect(names).toEqual(['Lab']);
  });

  it('es solo lectura: cualquier cambio da 403 y no se guarda', async () => {
    const { ana, beto, base } = await setup();
    const response = await app.inject({
      method: 'POST',
      url: `${base}/projects`,
      cookies: ana.cookies,
      headers: asBeto(beto.user.id),
      payload: { name: 'Nuevo' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json<{ message: string }>().message).toContain('solo lectura');
    expect(await db.project.count({ where: { name: 'Nuevo' } })).toBe(0);
  });

  it('solo el Admin del espacio, y solo con miembros del espacio', async () => {
    const { ana, beto, base } = await setup();
    // Beto no es Admin: no puede ver como Ana
    const notAdmin = await app.inject({
      url: `${base}/projects`,
      cookies: beto.cookies,
      headers: asBeto(ana.user.id),
    });
    expect(notAdmin.statusCode).toBe(403);

    // Carla no es miembro de Monex
    const carla = await userWithSession(db, 'carla@example.com');
    const outsider = await app.inject({
      url: `${base}/projects`,
      cookies: ana.cookies,
      headers: asBeto(carla.user.id),
    });
    expect(outsider.statusCode).toBe(400);

    const invalid = await app.inject({
      url: `${base}/projects`,
      cookies: ana.cookies,
      headers: { [VIEW_AS_HEADER]: 'no-es-un-id' },
    });
    expect(invalid.statusCode).toBe(400);
  });
});
