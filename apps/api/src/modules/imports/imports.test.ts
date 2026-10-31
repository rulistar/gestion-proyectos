import { CSV_BASE_COLUMNS, importPreviewSchema, toCsv } from '@gestion/shared';
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

/** Monex con "Certificación Linux" (folio PY2610-003) y su tarea "Lab 1" */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Monex' });
  const base = `/api/v1/workspaces/${ws.id}`;
  const linux = await app.inject({
    method: 'POST',
    url: `${base}/projects`,
    cookies: ana.cookies,
    payload: { name: 'Certificación Linux', folio: 'PY2610-003' },
  });
  const linuxId = linux.json<{ id: string }>().id;
  await app.inject({
    method: 'POST',
    url: `${base}/projects/${linuxId}/tasks`,
    cookies: ana.cookies,
    payload: { title: 'Lab 1' },
  });
  return { ana, ws, base, linuxId };
}

const header = [...CSV_BASE_COLUMNS, 'Severidad'];
const row = (values: Record<string, string>) => header.map((column) => values[column] ?? '');

/** El ejemplo del PO: Linux ya existe (con "Lab 3" nueva) y "Portal clientes" es nuevo */
const csv = toCsv([
  header,
  row({
    Proyecto: 'Certificación Linux',
    Folio: 'PY2610-003',
    Estado: 'En curso',
    Tarea: 'lab 1',
    'Estado de la tarea': 'Hecha',
  }),
  row({
    Proyecto: 'Certificación Linux',
    Folio: 'PY2610-003',
    Fase: 'Módulo 101 / Tema 1',
    Tarea: 'Lab 3',
    Tipo: 'Ticket',
    Responsable: 'Luis Pérez',
    'Tarea fin': '15/11/2026',
  }),
  row({
    Proyecto: 'Portal clientes',
    Sección: 'Mantenimientos',
    Tarea: 'Diseño',
    Origen: 'Correo',
  }),
]);

function send(cookies: Cookies, base: string, step: 'preview' | 'apply', content = csv) {
  return app.inject({
    method: 'POST',
    url: `${base}/import/${step}?today=2026-10-31`,
    cookies,
    payload: { fileName: 'carga.csv', content },
  });
}

describe('cargar información (HU-14)', () => {
  it('la vista previa cuenta lo nuevo y lo actualizado, y lista lo que se creará; no escribe', async () => {
    const { ana, base } = await setup();
    const response = await send(ana.cookies, base, 'preview');
    expect(response.statusCode).toBe(200);
    const preview = importPreviewSchema.parse(response.json());
    expect(preview).toMatchObject({
      source: 'Excel (CSV)',
      containers: { created: 1, updated: 1 },
      tasks: { created: 2, updated: 1 },
      newCatalog: { taskTypes: ['Ticket'], origins: [], people: ['Luis Pérez'], phases: 2 },
    });
    // "Correo" ya viene en el catálogo inicial de orígenes
    expect(await db.project.count()).toBe(1);
    expect(await db.taskType.count({ where: { name: 'Ticket' } })).toBe(0);
  });

  it('aplicar crea y actualiza (sin borrar), con fases, catálogos y fechas normalizadas', async () => {
    const { ana, base, linuxId } = await setup();
    const response = await send(ana.cookies, base, 'apply');
    expect(response.statusCode).toBe(200);

    const linux = await db.project.findUniqueOrThrow({
      where: { id: linuxId },
      include: { tasks: { include: { phase: true, type: true, responsiblePerson: true } } },
    });
    expect(linux.status).toBe('IN_PROGRESS');
    expect(linux.startedAt).not.toBeNull();
    const lab1 = linux.tasks.find((task) => task.title === 'Lab 1')!;
    expect([lab1.status, lab1.completedAt !== null]).toEqual(['DONE', true]);
    const lab3 = linux.tasks.find((task) => task.title === 'Lab 3')!;
    expect(lab3.phase?.name).toBe('Tema 1');
    expect(lab3.type.name).toBe('Ticket');
    expect(lab3.responsiblePerson?.name).toBe('Luis Pérez');
    expect(lab3.endDate?.toISOString().slice(0, 10)).toBe('2026-11-15');

    const portal = await db.project.findFirstOrThrow({
      where: { name: 'Portal clientes' },
      include: { type: true, tasks: { include: { origin: true } } },
    });
    expect(portal.type.behavior).toBe('ONGOING');
    expect(portal.folio).toMatch(/^MT2610-/);
    expect(portal.tasks[0]?.origin?.name).toBe('Correo');

    // Cargar dos veces el mismo archivo no duplica: la segunda vez todo es "actualizar"
    const again = importPreviewSchema.parse((await send(ana.cookies, base, 'preview')).json());
    expect(again).toMatchObject({
      containers: { created: 0, updated: 2 },
      tasks: { created: 0, updated: 3 },
      newCatalog: { taskTypes: [], people: [], phases: 0 },
    });
  });

  it('lee el JSON de Exportar de otro espacio', async () => {
    const { ana, base } = await setup();
    const exported = await app.inject({ url: `${base}/export.json`, cookies: ana.cookies });
    const other = await createWorkspace(db, ana.user.id, { name: 'Copia' });
    const otherBase = `/api/v1/workspaces/${other.id}`;
    const applied = await send(ana.cookies, otherBase, 'apply', exported.body);
    expect(applied.statusCode).toBe(200);
    const copy = await db.project.findFirstOrThrow({
      where: { workspaceId: other.id, name: 'Certificación Linux' },
      include: { tasks: true },
    });
    expect(copy.folio).toBe('PY2610-003');
    expect(copy.tasks.map((task) => task.title)).toEqual(['Lab 1']);
  });

  it('solo el Admin carga; un archivo sin nada que cargar da 400', async () => {
    const { ws, base, ana } = await setup();
    const beto = await userWithSession(db, 'beto@example.com');
    await addMember(db, ws.id, beto.user.id, 'MEMBER');
    expect((await send(beto.cookies, base, 'preview')).statusCode).toBe(403);
    const empty = await send(ana.cookies, base, 'preview', 'Nombre,Otra\nx,y');
    expect(empty.statusCode).toBe(400);
    expect(empty.json<{ message: string }>().message).toContain('"Proyecto"');
  });
});
