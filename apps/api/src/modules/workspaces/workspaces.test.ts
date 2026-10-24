import { workspaceListSchema, workspaceSummarySchema } from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { auditCreate, auditSoftDelete } from '../../db/audit.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { createSession, SESSION_COOKIE } from '../auth/session.js';

const db = createTestDb();
const app = buildApp({ db });

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

/** Usuario con sesión iniciada (sin pasar por el login: eso ya lo prueba auth.test.ts) */
async function userWithSession(email: string) {
  const user = await db.user.create({ data: { email, name: email, ...auditCreate(null) } });
  const token = await createSession(db, { userId: user.id, idleMinutes: 60 });
  return { user, cookies: { [SESSION_COOKIE]: token } };
}

function createWs(cookies: Record<string, string>, name: unknown) {
  return app.inject({ method: 'POST', url: '/api/v1/workspaces', cookies, payload: { name } });
}

function listWs(cookies: Record<string, string>) {
  return app.inject({ method: 'GET', url: '/api/v1/workspaces', cookies });
}

describe('sin sesión', () => {
  it('no permite listar ni crear workspaces', async () => {
    expect((await listWs({})).statusCode).toBe(401);
    expect((await createWs({}, 'Equipo')).statusCode).toBe(401);
    expect(await db.workspace.count()).toBe(0);
  });
});

describe('POST /workspaces (HU-03)', () => {
  it('crea el workspace y deja a quien lo crea como Admin', async () => {
    const ana = await userWithSession('ana@example.com');

    const response = await createWs(ana.cookies, '  Equipo de cursos  ');

    expect(response.statusCode).toBe(201);
    const body = workspaceSummarySchema.parse(response.json());
    expect(body).toMatchObject({ name: 'Equipo de cursos', role: 'ADMIN' });

    const membership = await db.membership.findFirstOrThrow({ where: { workspaceId: body.id } });
    expect(membership).toMatchObject({ userId: ana.user.id, role: 'ADMIN' });
  });

  it('registra quién lo creó y cuándo (RNF-01)', async () => {
    const ana = await userWithSession('ana@example.com');
    const before = new Date();

    const { id } = workspaceSummarySchema.parse((await createWs(ana.cookies, 'Equipo')).json());

    const workspace = await db.workspace.findUniqueOrThrow({ where: { id } });
    expect(workspace).toMatchObject({ createdById: ana.user.id, updatedById: ana.user.id });
    expect(workspace.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  it.each([
    ['vacío', '   '],
    ['demasiado largo', 'x'.repeat(81)],
    ['que no es texto', 42],
  ])('rechaza un nombre %s con 400 y no crea nada', async (_caso, name) => {
    const ana = await userWithSession('ana@example.com');

    const response = await createWs(ana.cookies, name);

    expect(response.statusCode).toBe(400);
    expect(await db.workspace.count()).toBe(0);
  });
});

describe('GET /workspaces', () => {
  it('muestra solo los workspaces de los que soy miembro', async () => {
    const ana = await userWithSession('ana@example.com');
    const luis = await userWithSession('luis@example.com');
    await createWs(ana.cookies, 'De Ana');
    await createWs(luis.cookies, 'De Luis');

    const anaList = workspaceListSchema.parse((await listWs(ana.cookies)).json());
    const luisList = workspaceListSchema.parse((await listWs(luis.cookies)).json());

    expect(anaList.map((w) => w.name)).toEqual(['De Ana']);
    expect(luisList.map((w) => w.name)).toEqual(['De Luis']);
  });

  it('no muestra workspaces ni membresías que están en la papelera', async () => {
    const ana = await userWithSession('ana@example.com');
    const kept = workspaceSummarySchema.parse((await createWs(ana.cookies, 'Activo')).json());
    const trashed = workspaceSummarySchema.parse((await createWs(ana.cookies, 'Borrado')).json());
    const left = workspaceSummarySchema.parse((await createWs(ana.cookies, 'Me salí')).json());

    await db.workspace.update({
      where: { id: trashed.id },
      data: auditSoftDelete(ana.user.id),
    });
    await db.membership.updateMany({
      where: { workspaceId: left.id },
      data: auditSoftDelete(ana.user.id),
    });

    const list = workspaceListSchema.parse((await listWs(ana.cookies)).json());
    expect(list).toEqual([kept]);
  });
});
