import { workspaceListSchema, workspaceSummarySchema } from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { auditSoftDelete } from '../../db/audit.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession as createUser } from '../../test/users.js';

const db = createTestDb();
const app = buildApp({ db });

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

const userWithSession = (email: string) => createUser(db, email);

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

describe('GET /workspaces/:workspaceId', () => {
  it('devuelve el workspace con mi rol en él', async () => {
    const ana = await userWithSession('ana@example.com');
    const luis = await userWithSession('luis@example.com');
    const ws = workspaceSummarySchema.parse((await createWs(ana.cookies, 'Equipo')).json());
    await addMember(db, ws.id, luis.user.id, 'VIEWER');

    const asAna = await app.inject({ url: `/api/v1/workspaces/${ws.id}`, cookies: ana.cookies });
    const asLuis = await app.inject({ url: `/api/v1/workspaces/${ws.id}`, cookies: luis.cookies });

    expect(asAna.json()).toEqual({ id: ws.id, name: 'Equipo', role: 'ADMIN' });
    expect(asLuis.json()).toEqual({ id: ws.id, name: 'Equipo', role: 'VIEWER' });
  });

  it('responde 404 a quien no es miembro y a un ID no válido (no revela si existe)', async () => {
    const ana = await userWithSession('ana@example.com');
    const luis = await userWithSession('luis@example.com');
    const ws = workspaceSummarySchema.parse((await createWs(ana.cookies, 'De Ana')).json());

    const notMember = await app.inject({
      url: `/api/v1/workspaces/${ws.id}`,
      cookies: luis.cookies,
    });
    const invalid = await app.inject({
      url: '/api/v1/workspaces/no-es-un-id',
      cookies: ana.cookies,
    });

    expect(notMember.statusCode).toBe(404);
    expect(invalid.statusCode).toBe(404);
  });
});
