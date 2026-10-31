import { detailFieldListSchema, type DetailField } from '@gestion/shared';
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

/** Ana es Admin del espacio "Equipo" (con su catálogo inicial) y Beto, Miembro */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  const beto = await userWithSession(db, 'beto@example.com');
  await addMember(db, ws.id, beto.user.id, 'MEMBER');
  const incidencia = await db.taskType.findFirstOrThrow({
    where: { workspaceId: ws.id, name: 'Incidencia' },
  });
  const correctivo = await db.projectType.findFirstOrThrow({
    where: { workspaceId: ws.id, name: 'Mtto correctivo' },
  });
  return { ana, beto, ws, incidencia, correctivo };
}

const url = (ws: string) => `/api/v1/workspaces/${ws}/detail-fields`;

function create(cookies: Cookies, ws: string, payload: object) {
  return app.inject({ method: 'POST', url: url(ws), cookies, payload });
}

function update(cookies: Cookies, ws: string, fieldId: string, payload: object) {
  return app.inject({ method: 'PATCH', url: `${url(ws)}/${fieldId}`, cookies, payload });
}

async function list(cookies: Cookies, ws: string): Promise<DetailField[]> {
  const response = await app.inject({ url: url(ws), cookies });
  expect(response.statusCode).toBe(200);
  return detailFieldListSchema.parse(response.json());
}

const severidad = (taskTypeId: string) => ({
  taskTypeId,
  name: 'Severidad',
  kind: 'OPTIONS',
  required: true,
  options: ['Crítica', 'Alta', 'Media', 'Baja'],
});

describe('campos de detalle por tipo (HU-23)', () => {
  it('el Admin agrega campos a un tipo de tarea y a uno de contenedor, en orden', async () => {
    const { ana, beto, ws, incidencia, correctivo } = await setup();
    expect((await create(ana.cookies, ws.id, severidad(incidencia.id))).statusCode).toBe(201);
    await create(ana.cookies, ws.id, {
      taskTypeId: incidencia.id,
      name: 'Sistema afectado',
      kind: 'SHORT_TEXT',
    });
    await create(ana.cookies, ws.id, {
      projectTypeId: correctivo.id,
      name: 'Sistema o aplicación',
      kind: 'SHORT_TEXT',
      required: true,
    });

    // El Miembro los ve (los formularios los necesitan)
    const fields = await list(beto.cookies, ws.id);
    expect(
      fields
        .filter((field) => field.taskTypeId === incidencia.id)
        .map((field) => [field.name, field.kind, field.required, field.position]),
    ).toEqual([
      ['Severidad', 'OPTIONS', true, 0],
      ['Sistema afectado', 'SHORT_TEXT', false, 1],
    ]);
    expect(fields.find((field) => field.projectTypeId === correctivo.id)?.name).toBe(
      'Sistema o aplicación',
    );
    const row = await db.detailField.findFirstOrThrow({ where: { name: 'Severidad' } });
    expect(row.createdById).toBe(ana.user.id);
  });

  it('valida: lista sin opciones, opciones en un texto, sin dueño o con los dos, nombre repetido', async () => {
    const { ana, ws, incidencia, correctivo } = await setup();
    const bad = [
      { taskTypeId: incidencia.id, name: 'Severidad', kind: 'OPTIONS' },
      { taskTypeId: incidencia.id, name: 'Sistema', kind: 'SHORT_TEXT', options: ['A'] },
      { name: 'Huérfano', kind: 'DATE' },
      { taskTypeId: incidencia.id, projectTypeId: correctivo.id, name: 'Doble', kind: 'DATE' },
      { ...severidad(incidencia.id), options: ['Alta', 'alta'] },
    ];
    for (const payload of bad) {
      expect((await create(ana.cookies, ws.id, payload)).statusCode).toBe(400);
    }
    await create(ana.cookies, ws.id, severidad(incidencia.id));
    const repeated = await create(ana.cookies, ws.id, {
      ...severidad(incidencia.id),
      name: 'severidad',
    });
    expect(repeated.statusCode).toBe(409);
  });

  it('solo el Admin los define; un tipo de otro espacio da 400', async () => {
    const { ana, beto, ws, incidencia } = await setup();
    expect((await create(beto.cookies, ws.id, severidad(incidencia.id))).statusCode).toBe(403);
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    expect((await create(ana.cookies, other.id, severidad(incidencia.id))).statusCode).toBe(400);
  });

  it('renombrar, obligatorio y agregar opciones sí; quitar opciones no; archivar conserva el campo', async () => {
    const { ana, ws, incidencia } = await setup();
    await create(ana.cookies, ws.id, severidad(incidencia.id));
    const [field] = await list(ana.cookies, ws.id);
    const id = field!.id;

    const renamed = await update(ana.cookies, ws.id, id, {
      name: 'Gravedad',
      required: false,
      options: ['Crítica', 'Alta', 'Media', 'Baja', 'Mínima'],
    });
    expect(renamed.statusCode).toBe(200);
    const [after] = detailFieldListSchema.parse(renamed.json());
    expect([after!.name, after!.required, after!.options.length]).toEqual(['Gravedad', false, 5]);

    const removed = await update(ana.cookies, ws.id, id, { options: ['Alta', 'Baja'] });
    expect(removed.statusCode).toBe(409);
    expect(removed.json<{ message: string }>().message).toContain('Crítica, Media, Mínima');

    const archived = await update(ana.cookies, ws.id, id, { archived: true });
    expect(detailFieldListSchema.parse(archived.json())[0]?.archived).toBe(true);
    // Archivado, su nombre queda libre
    expect((await create(ana.cookies, ws.id, severidad(incidencia.id))).statusCode).toBe(201);
    // Y no se puede reactivar con el mismo nombre que otro activo
    expect(
      (await update(ana.cookies, ws.id, id, { name: 'Severidad', archived: false })).statusCode,
    ).toBe(409);

    const unknown = await update(ana.cookies, ws.id, '01a18cf0-0000-7000-8000-000000000000', {
      name: 'X',
    });
    expect(unknown.statusCode).toBe(404);
  });

  it('subir y bajar cambia el orden dentro del mismo tipo', async () => {
    const { ana, ws, incidencia } = await setup();
    for (const name of ['Uno', 'Dos', 'Tres']) {
      await create(ana.cookies, ws.id, { taskTypeId: incidencia.id, name, kind: 'SHORT_TEXT' });
    }
    const tres = (await list(ana.cookies, ws.id)).find((field) => field.name === 'Tres')!;
    const moved = await app.inject({
      method: 'POST',
      url: `${url(ws.id)}/${tres.id}/move`,
      cookies: ana.cookies,
      payload: { direction: 'up' },
    });
    expect(moved.statusCode).toBe(200);
    expect(detailFieldListSchema.parse(moved.json()).map((field) => field.name)).toEqual([
      'Uno',
      'Tres',
      'Dos',
    ]);
  });
});
