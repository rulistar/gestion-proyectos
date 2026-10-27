import { projectSchema, projectTypeListSchema, type MembershipRole } from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createWorkspace } from '../workspaces/workspaces.service.js';
import { realDatesFor } from '../projects/projects.service.js';

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

const typesUrl = (ws: string) => `/api/v1/workspaces/${ws}/project-types`;
const projectsUrl = (ws: string) => `/api/v1/workspaces/${ws}/projects`;

async function types(cookies: Cookies, ws: string) {
  const response = await app.inject({ url: typesUrl(ws), cookies });
  expect(response.statusCode).toBe(200);
  return projectTypeListSchema.parse(response.json());
}

function patchType(cookies: Cookies, ws: string, typeId: string, payload: object) {
  return app.inject({ method: 'PATCH', url: `${typesUrl(ws)}/${typeId}`, cookies, payload });
}

async function createProjectOk(cookies: Cookies, ws: string, payload: object) {
  const response = await app.inject({ method: 'POST', url: projectsUrl(ws), cookies, payload });
  expect(response.statusCode).toBe(201);
  return projectSchema.parse(response.json());
}

describe('catálogo de tipos de contenedor (HU-21)', () => {
  it('un espacio nuevo trae los tipos iniciales (ADR-0004 §5)', async () => {
    const { ana, ws } = await setup();
    expect((await types(ana.cookies, ws.id)).map((t) => [t.name, t.behavior])).toEqual([
      ['Proyecto', 'WITH_END'],
      ['Mtto correctivo', 'ONGOING'],
      ['Mtto evolutivo', 'ONGOING'],
      ['Actividades', 'ON_DEMAND'],
    ]);
  });

  it('el Admin agrega un tipo; el nombre se repite → 409', async () => {
    const { ana, ws } = await setup();
    const payload = { name: 'Mtto preventivo', behavior: 'ONGOING' };

    const created = await app.inject({
      method: 'POST',
      url: typesUrl(ws.id),
      cookies: ana.cookies,
      payload,
    });
    const again = await app.inject({
      method: 'POST',
      url: typesUrl(ws.id),
      cookies: ana.cookies,
      payload: { ...payload, name: 'mtto PREVENTIVO' },
    });

    expect(created.statusCode).toBe(201);
    expect(projectTypeListSchema.parse(created.json()).at(-1)).toMatchObject({
      ...payload,
      position: 4,
      archived: false,
    });
    expect(again.statusCode).toBe(409);
  });

  it('un Miembro ve el catálogo pero no lo cambia (403)', async () => {
    const { ws, withRole } = await setup();
    const luis = await withRole('luis@example.com', 'MEMBER');
    const [first] = await types(luis.cookies, ws.id);

    const create = await app.inject({
      method: 'POST',
      url: typesUrl(ws.id),
      cookies: luis.cookies,
      payload: { name: 'X', behavior: 'ONGOING' },
    });
    expect(create.statusCode).toBe(403);
    expect((await patchType(luis.cookies, ws.id, first!.id, { name: 'Y' })).statusCode).toBe(403);
  });

  it('renombrar, cambiar el comportamiento y archivar; archivado ya no se ofrece al crear', async () => {
    const { ana, ws } = await setup();
    const list = await types(ana.cookies, ws.id);
    const evolutivo = list.find((t) => t.name === 'Mtto evolutivo')!;

    const renamed = await patchType(ana.cookies, ws.id, evolutivo.id, {
      name: 'Evolutivo',
      behavior: 'WITH_END',
    });
    const archived = await patchType(ana.cookies, ws.id, evolutivo.id, { archived: true });
    const useArchived = await app.inject({
      method: 'POST',
      url: projectsUrl(ws.id),
      cookies: ana.cookies,
      payload: { name: 'X', typeId: evolutivo.id },
    });

    expect(renamed.statusCode).toBe(200);
    expect(
      projectTypeListSchema.parse(archived.json()).find((t) => t.id === evolutivo.id),
    ).toMatchObject({ name: 'Evolutivo', behavior: 'WITH_END', archived: true });
    expect(useArchived.statusCode).toBe(400);
  });

  it('un proyecto conserva su tipo archivado al editarse, y cuenta en projectCount', async () => {
    const { ana, ws } = await setup();
    const correctivo = (await types(ana.cookies, ws.id)).find((t) => t.name === 'Mtto correctivo')!;
    const project = await createProjectOk(ana.cookies, ws.id, {
      name: 'ERP',
      typeId: correctivo.id,
    });
    await patchType(ana.cookies, ws.id, correctivo.id, { archived: true });

    const edited = await app.inject({
      method: 'PUT',
      url: `${projectsUrl(ws.id)}/${project.id}`,
      cookies: ana.cookies,
      payload: { name: 'ERP 2', typeId: correctivo.id },
    });

    expect(edited.statusCode).toBe(200);
    expect(projectSchema.parse(edited.json()).type.name).toBe('Mtto correctivo');
    const after = await types(ana.cookies, ws.id);
    expect(after.find((t) => t.id === correctivo.id)?.projectCount).toBe(1);
  });

  it('no se archiva el último tipo activo (409)', async () => {
    const { ana, ws } = await setup();
    const [last, ...rest] = await types(ana.cookies, ws.id);
    for (const type of rest) await patchType(ana.cookies, ws.id, type.id, { archived: true });

    expect((await patchType(ana.cookies, ws.id, last!.id, { archived: true })).statusCode).toBe(
      409,
    );
  });

  it('un tipo de otro espacio no se puede usar ni cambiar (400 / 404)', async () => {
    const { ana, ws } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const [foreign] = await types(ana.cookies, other.id);

    const create = await app.inject({
      method: 'POST',
      url: projectsUrl(ws.id),
      cookies: ana.cookies,
      payload: { name: 'X', typeId: foreign!.id },
    });
    expect(create.statusCode).toBe(400);
    expect((await patchType(ana.cookies, ws.id, foreign!.id, { name: 'Z' })).statusCode).toBe(404);
  });
});

describe('métricas por comportamiento (ADR-0004 §2)', () => {
  it('un mantenimiento cuenta abiertas, vencidas (con la fecha del usuario) y hechas del mes', async () => {
    const { ana, ws } = await setup();
    const correctivo = (await types(ana.cookies, ws.id)).find((t) => t.name === 'Mtto correctivo')!;
    const project = await createProjectOk(ana.cookies, ws.id, {
      name: 'ERP',
      typeId: correctivo.id,
    });
    const tasksUrl = `${projectsUrl(ws.id)}/${project.id}/tasks`;
    for (const payload of [
      { title: 'Vencida', endDate: '2026-10-20' },
      { title: 'Abierta', endDate: '2026-10-30' },
      { title: 'Hecha', status: 'DONE' },
    ]) {
      await app.inject({ method: 'POST', url: tasksUrl, cookies: ana.cookies, payload });
    }

    const monthStart = new Date(Date.now() - 60_000).toISOString();
    const response = await app.inject({
      url: `${projectsUrl(ws.id)}/${project.id}?today=2026-10-28&monthStart=${monthStart}`,
      cookies: ana.cookies,
    });

    expect(projectSchema.parse(response.json()).progress).toMatchObject({
      openTasks: 2,
      overdueTasks: 1,
      doneThisMonth: 1,
      // La vencida es la abierta más próxima; la Hecha no cuenta
      nextDueDate: '2026-10-20',
    });
  });
});

describe('fechas reales del contenedor (ADR-0004 §2.1)', () => {
  const t1 = new Date('2026-10-01T10:00:00Z');
  const t2 = new Date('2026-10-05T10:00:00Z');

  it('el inicio se registra la primera vez que pasa a En curso y no se borra', () => {
    expect(realDatesFor('NOT_STARTED', null, t1)).toEqual({ startedAt: null, finishedAt: null });
    expect(realDatesFor('IN_PROGRESS', null, t1)).toEqual({ startedAt: t1, finishedAt: null });
    const previous = { status: 'IN_PROGRESS' as const, startedAt: t1, finishedAt: null };
    expect(realDatesFor('PAUSED', previous, t2)).toEqual({ startedAt: t1, finishedAt: null });
  });

  it('el fin se registra al terminar o cancelar, se conserva y se vacía al reabrir', () => {
    const running = { status: 'IN_PROGRESS' as const, startedAt: t1, finishedAt: null };
    expect(realDatesFor('DONE', running, t2)).toEqual({ startedAt: t1, finishedAt: t2 });
    const done = { status: 'DONE' as const, startedAt: t1, finishedAt: t2 };
    expect(realDatesFor('CANCELLED', done, new Date())).toEqual({ startedAt: t1, finishedAt: t2 });
    expect(realDatesFor('IN_PROGRESS', done, new Date())).toEqual({
      startedAt: t1,
      finishedAt: null,
    });
  });

  it('terminar sin pasar por En curso registra ambas fechas', () => {
    expect(realDatesFor('DONE', null, t1)).toEqual({ startedAt: t1, finishedAt: t1 });
  });

  it('la API guarda las fechas reales al cambiar el estado', async () => {
    const { ana, ws } = await setup();
    const project = await createProjectOk(ana.cookies, ws.id, { name: 'P' });
    expect(project.startedAt).toBeNull();

    const started = await app.inject({
      method: 'PUT',
      url: `${projectsUrl(ws.id)}/${project.id}`,
      cookies: ana.cookies,
      payload: { name: 'P', status: 'IN_PROGRESS' },
    });

    expect(projectSchema.parse(started.json()).startedAt).not.toBeNull();
  });
});
