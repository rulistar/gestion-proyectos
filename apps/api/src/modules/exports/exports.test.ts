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

function post(cookies: Cookies, url: string, payload: object) {
  return app.inject({ method: 'POST', url, cookies, payload });
}

/**
 * "Monex" con "Certificación Linux" (fase Módulo 101 → Tema 1, una tarea en cada una y una
 * suelta), "Portal clientes" sin tareas y una Incidencia con Severidad. Beto es Lector: solo
 * trabajo (ADR-0006), y "Gimnasio" es personal.
 */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Monex Ñandú' });
  const base = `/api/v1/workspaces/${ws.id}`;
  const incidencia = await db.taskType.findFirstOrThrow({
    where: { workspaceId: ws.id, name: 'Incidencia' },
  });
  const field = await post(ana.cookies, `${base}/detail-fields`, {
    taskTypeId: incidencia.id,
    name: 'Severidad',
    kind: 'OPTIONS',
    options: ['Alta', 'Baja'],
  });
  const severidadId = field.json<{ id: string; name: string }[]>()[0]!.id;

  // Con ?today= el folio automático no depende del reloj (PY2610-001)
  const linux = await post(ana.cookies, `${base}/projects?today=2026-10-31`, {
    name: 'Certificación Linux',
    area: 'TI',
    priority: 'HIGH',
    startDate: '2026-11-01',
    endDate: '2026-12-15',
  });
  const linuxId = linux.json<{ id: string }>().id;
  const phases = `${base}/projects/${linuxId}/phases`;
  // POST de una fase devuelve la fase creada
  const m101 = (await post(ana.cookies, phases, { name: 'Módulo 101' })).json<{ id: string }>();
  const temaId = (await post(ana.cookies, phases, { name: 'Tema 1', parentId: m101.id })).json<{
    id: string;
  }>().id;
  const tasks = `${base}/projects/${linuxId}/tasks`;
  await post(ana.cookies, tasks, {
    title: 'Lab 1, parte "A"',
    phaseId: temaId,
    estimatedMinutes: 90,
    startDate: '2026-11-02',
    endDate: '2026-11-06',
    status: 'DONE',
  });
  await post(ana.cookies, tasks, {
    title: 'Falla en el lab',
    typeId: incidencia.id,
    details: { [severidadId]: 'Alta' },
  });
  await post(ana.cookies, `${base}/projects`, { name: 'Portal clientes' });
  await post(ana.cookies, `${base}/projects`, { name: 'Gimnasio', scope: 'PERSONAL' });

  const beto = await userWithSession(db, 'beto@example.com');
  await addMember(db, ws.id, beto.user.id, 'VIEWER');
  return { ana, beto, ws, base };
}

describe('exportar (HU-13)', () => {
  it('CSV: una fila por tarea con fase, detalle y BOM; un contenedor sin tareas lleva una fila', async () => {
    const { ana, base } = await setup();
    const response = await app.inject({
      url: `${base}/export.csv?today=2026-10-31`,
      cookies: ana.cookies,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="Monex-Nandu-2026-10-31.csv"',
    );
    expect(response.body.startsWith('﻿Proyecto,Área,Clasificación,Estado,')).toBe(true);
    const lines = response.body.slice(1).trimEnd().split('\r\n');
    expect(lines[0]!.endsWith(',Detalle del origen,Severidad')).toBe(true);
    const lab = lines.find((line) => line.includes('Lab 1'))!;
    expect(lab).toBe(
      'Certificación Linux,TI,,No iniciado,Alta,2026-11-01,2026-12-15,Módulo 101 / Tema 1,2026-11-02,2026-11-06,"Lab 1, parte ""A""",Tarea,90,2026-11-02,2026-11-06,Sí,Proyectos,Proyecto,PY2610-001,Hecha,,,,',
    );
    expect(lines.find((line) => line.includes('Falla en el lab'))!.endsWith(',Alta')).toBe(true);
    expect(lines.filter((line) => line.startsWith('Portal clientes,'))).toHaveLength(1);
    expect(lines).toHaveLength(1 + 4);
  });

  it('JSON: catálogos, personas y contenedores con fases y tareas', async () => {
    const { ana, base } = await setup();
    const response = await app.inject({ url: `${base}/export.json`, cookies: ana.cookies });
    expect(response.statusCode).toBe(200);
    const data = response.json<{
      format: string;
      version: number;
      catalogs: { detailFields: unknown[] };
      projects: { name: string; phases: unknown[]; tasks: unknown[] }[];
    }>();
    expect([data.format, data.version]).toEqual(['gestor-de-proyectos', 1]);
    expect(data.catalogs.detailFields).toHaveLength(1);
    const linux = data.projects.find((project) => project.name === 'Certificación Linux')!;
    expect([linux.phases.length, linux.tasks.length]).toEqual([2, 2]);
  });

  it('cada quien exporta solo lo que ve; lo de la papelera no sale; sin membresía, 404', async () => {
    const { ana, beto, ws, base } = await setup();
    const portal = await db.project.findFirstOrThrow({ where: { name: 'Portal clientes' } });
    await db.project.update({ where: { id: portal.id }, data: { deletedAt: new Date() } });

    const lector = await app.inject({ url: `${base}/export.csv`, cookies: beto.cookies });
    expect(lector.statusCode).toBe(200);
    // El Lector solo ve lo de trabajo: "Gimnasio" (personal) no sale
    expect(lector.body).not.toContain('Gimnasio');
    expect(lector.body).not.toContain('Portal clientes');
    expect(lector.body).toContain('Certificación Linux');

    const admin = await app.inject({ url: `${base}/export.json`, cookies: ana.cookies });
    expect(admin.body).toContain('Gimnasio');
    expect(admin.body).not.toContain('Portal clientes');

    const luis = await userWithSession(db, 'luis@example.com');
    const outsider = await app.inject({ url: `${base}/export.csv`, cookies: luis.cookies });
    expect(outsider.statusCode).toBe(404);
    expect(ws.id).toBeTruthy();
  });
});
