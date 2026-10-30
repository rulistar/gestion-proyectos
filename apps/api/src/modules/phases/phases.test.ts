import {
  phaseListSchema,
  projectTypeListSchema,
  taskListSchema,
  taskSchema,
  trashListSchema,
} from '@gestion/shared';
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

const base = (ws: string) => `/api/v1/workspaces/${ws}`;

// Proyecto "Certificación Linux" (el ejemplo que confirmó el PO)
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  const project = await app.inject({
    method: 'POST',
    url: `${base(ws.id)}/projects`,
    cookies: ana.cookies,
    payload: { name: 'Certificación Linux' },
  });
  const projectId = project.json<{ id: string }>().id;
  const phasesUrl = `${base(ws.id)}/projects/${projectId}/phases`;
  const tasksUrl = `${base(ws.id)}/projects/${projectId}/tasks`;

  async function addPhase(name: string, parentId?: string, cookies: Cookies = ana.cookies) {
    return app.inject({ method: 'POST', url: phasesUrl, cookies, payload: { name, parentId } });
  }
  async function phaseId(name: string, parentId?: string) {
    const response = await addPhase(name, parentId);
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>().id;
  }
  async function phases(cookies: Cookies = ana.cookies) {
    const response = await app.inject({ url: phasesUrl, cookies });
    expect(response.statusCode).toBe(200);
    return phaseListSchema.parse(response.json());
  }
  async function addTask(title: string, phase: string | null) {
    const response = await app.inject({
      method: 'POST',
      url: tasksUrl,
      cookies: ana.cookies,
      payload: { title, phaseId: phase },
    });
    expect(response.statusCode).toBe(201);
    return taskSchema.parse(response.json());
  }
  async function tasks() {
    const response = await app.inject({ url: tasksUrl, cookies: ana.cookies });
    return taskListSchema.parse(response.json());
  }
  async function trash() {
    const response = await app.inject({ url: `${base(ws.id)}/trash`, cookies: ana.cookies });
    return trashListSchema.parse(response.json());
  }
  return {
    ana,
    ws,
    projectId,
    phasesUrl,
    tasksUrl,
    addPhase,
    phaseId,
    phases,
    addTask,
    tasks,
    trash,
  };
}

describe('fases (HU-07)', () => {
  it('crea fases y subfases hasta 4 niveles, en su orden', async () => {
    const { addPhase, phaseId, phases } = await setup();
    const m101 = await phaseId('Módulo 101');
    await phaseId('Módulo 102');
    const tema1 = await phaseId('Tema 1', m101);
    const parte = await phaseId('Parte A', tema1);
    const paso = await phaseId('Paso 1', parte);

    const fifth = await addPhase('Demasiado', paso);
    expect(fifth.statusCode).toBe(400);
    expect(fifth.json<{ message: string }>().message).toBe('Máximo 4 niveles de fases');

    const list = await phases();
    expect(list.map((p) => [p.name, p.position])).toEqual([
      ['Módulo 101', 0],
      ['Tema 1', 0],
      ['Parte A', 0],
      ['Paso 1', 0],
      ['Módulo 102', 1],
    ]);
    expect(list.find((p) => p.name === 'Tema 1')?.parentId).toBe(m101);
  });

  it('renombra y sube o baja una fase entre sus hermanas', async () => {
    const { ana, phasesUrl, phaseId, phases } = await setup();
    const m101 = await phaseId('Módulo 101');
    const m102 = await phaseId('Módulo 102');

    const rename = await app.inject({
      method: 'PATCH',
      url: `${phasesUrl}/${m102}`,
      cookies: ana.cookies,
      payload: { name: 'Módulo 102: Redes' },
    });
    expect(rename.statusCode).toBe(204);

    const up = await app.inject({
      method: 'POST',
      url: `${phasesUrl}/${m102}/move`,
      cookies: ana.cookies,
      payload: { direction: 'up' },
    });
    expect(up.statusCode).toBe(204);
    const list = await phases();
    expect(list.map((p) => p.name)).toEqual(['Módulo 102: Redes', 'Módulo 101']);

    // La primera no sube más
    const again = await app.inject({
      method: 'POST',
      url: `${phasesUrl}/${m102}/move`,
      cookies: ana.cookies,
      payload: { direction: 'up' },
    });
    expect(again.statusCode).toBe(204);
    expect((await phases()).map((p) => p.id)).toEqual([m102, m101]);
  });

  it('una tarea va en una fase o suelta; editar sin la fase la conserva', async () => {
    const { ana, ws, tasksUrl, phaseId, addTask } = await setup();
    const m101 = await phaseId('Módulo 101');
    const task = await addTask('Leer capítulo 1', m101);
    expect(task.phaseId).toBe(m101);

    // Mover de columna y editar sin enviar phaseId no la sacan de la fase
    const status = await app.inject({
      method: 'PATCH',
      url: `${tasksUrl}/${task.id}/status`,
      cookies: ana.cookies,
      payload: { status: 'DONE' },
    });
    expect(status.json<{ phaseId: string | null }>().phaseId).toBe(m101);
    const edit = await app.inject({
      method: 'PUT',
      url: `${tasksUrl}/${task.id}`,
      cookies: ana.cookies,
      payload: { title: 'Leer capítulo 1 y 2', status: 'DONE' },
    });
    expect(edit.json<{ phaseId: string | null }>().phaseId).toBe(m101);

    const loose = await app.inject({
      method: 'PUT',
      url: `${tasksUrl}/${task.id}`,
      cookies: ana.cookies,
      payload: { title: 'Leer capítulo 1 y 2', status: 'DONE', phaseId: '' },
    });
    expect(loose.json<{ phaseId: string | null }>().phaseId).toBeNull();

    // Una fase de otro proyecto no sirve
    const other = await app.inject({
      method: 'POST',
      url: `${base(ws.id)}/projects`,
      cookies: ana.cookies,
      payload: { name: 'Otro' },
    });
    const foreign = await app.inject({
      method: 'POST',
      url: `${base(ws.id)}/projects/${other.json<{ id: string }>().id}/phases`,
      cookies: ana.cookies,
      payload: { name: 'Ajena' },
    });
    const wrong = await app.inject({
      method: 'POST',
      url: tasksUrl,
      cookies: ana.cookies,
      payload: { title: 'X', phaseId: foreign.json<{ id: string }>().id },
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json<{ message: string }>().message).toBe('Esa fase no existe en este proyecto');
  });

  it('solo los tipos con "Usa fases" las admiten; el Admin lo cambia en el catálogo', async () => {
    const { ana, ws } = await setup();
    const types = projectTypeListSchema.parse(
      (await app.inject({ url: `${base(ws.id)}/project-types`, cookies: ana.cookies })).json(),
    );
    expect(types.map((t) => [t.name, t.usesPhases])).toEqual([
      ['Proyecto', true],
      ['Mtto correctivo', false],
      ['Mtto evolutivo', false],
      ['Actividades', false],
    ]);
    const mtto = types.find((t) => t.name === 'Mtto correctivo')!;
    const project = await app.inject({
      method: 'POST',
      url: `${base(ws.id)}/projects`,
      cookies: ana.cookies,
      payload: { name: 'ERP', typeId: mtto.id },
    });
    const url = `${base(ws.id)}/projects/${project.json<{ id: string }>().id}/phases`;
    const refused = await app.inject({
      method: 'POST',
      url,
      cookies: ana.cookies,
      payload: { name: 'Fase' },
    });
    expect(refused.statusCode).toBe(409);

    await app.inject({
      method: 'PATCH',
      url: `${base(ws.id)}/project-types/${mtto.id}`,
      cookies: ana.cookies,
      payload: { usesPhases: true },
    });
    const allowed = await app.inject({
      method: 'POST',
      url,
      cookies: ana.cookies,
      payload: { name: 'Fase' },
    });
    expect(allowed.statusCode).toBe(201);
  });

  it('las ve quien ve el contenedor; las maneja quien puede modificarlo', async () => {
    const { ws, phasesUrl, addPhase, phaseId, phases } = await setup();
    const m101 = await phaseId('Módulo 101');
    const lector = await userWithSession(db, 'lector@example.com');
    await addMember(db, ws.id, lector.user.id, 'VIEWER');
    const outsider = await userWithSession(db, 'otro@example.com');

    expect((await phases(lector.cookies)).map((p) => p.name)).toEqual(['Módulo 101']);
    expect((await addPhase('Nueva', undefined, lector.cookies)).statusCode).toBe(403);
    const rename = await app.inject({
      method: 'PATCH',
      url: `${phasesUrl}/${m101}`,
      cookies: lector.cookies,
      payload: { name: 'Mía' },
    });
    expect(rename.statusCode).toBe(403);
    const remove = await app.inject({
      method: 'DELETE',
      url: `${phasesUrl}/${m101}`,
      cookies: lector.cookies,
    });
    expect(remove.statusCode).toBe(403);
    // Quien no es del espacio no sabe que existe
    expect((await app.inject({ url: phasesUrl, cookies: outsider.cookies })).statusCode).toBe(404);
  });

  it('dar de baja una fase se lleva sus subfases y sus tareas; restaurarla las devuelve', async () => {
    const { ana, ws, phasesUrl, tasksUrl, phaseId, phases, addTask, tasks, trash } = await setup();
    const m101 = await phaseId('Módulo 101');
    const tema1 = await phaseId('Tema 1', m101);
    await phaseId('Módulo 102');
    await addTask('Leer capítulo 1', tema1);
    await addTask('Ejercicios', m101);
    await addTask('Comprar voucher', null);
    // Dada de baja antes, por separado: no vuelve con la fase
    const before = await addTask('Borrador', tema1);
    await app.inject({ method: 'DELETE', url: `${tasksUrl}/${before.id}`, cookies: ana.cookies });

    const removed = await app.inject({
      method: 'DELETE',
      url: `${phasesUrl}/${m101}`,
      cookies: ana.cookies,
    });
    expect(removed.statusCode).toBe(204);
    expect((await phases()).map((p) => p.name)).toEqual(['Módulo 102']);
    expect((await tasks()).map((t) => t.title)).toEqual(['Comprar voucher']);

    // En la papelera se ve la fase (con lo que se llevó); sus tareas y su subfase, no aparte
    const items = await trash();
    expect(items.map((i) => [i.kind, i.name, i.taskCount])).toEqual([['phase', 'Módulo 101', 2]]);
    expect(items[0]?.projectName).toBe('Certificación Linux');

    const restored = await app.inject({
      method: 'POST',
      url: `${base(ws.id)}/trash/phase/${m101}/restore`,
      cookies: ana.cookies,
    });
    expect(restored.statusCode).toBe(204);
    expect((await phases()).map((p) => p.name)).toEqual(['Módulo 101', 'Tema 1', 'Módulo 102']);
    expect((await tasks()).map((t) => t.title).sort()).toEqual([
      'Comprar voucher',
      'Ejercicios',
      'Leer capítulo 1',
    ]);
    expect((await trash()).map((i) => [i.kind, i.name])).toEqual([['task', 'Borrador']]);
  });

  it('borrar definitivamente una fase de la papelera se lleva su contenido', async () => {
    const { ana, ws, phasesUrl, phaseId, addTask } = await setup();
    const m101 = await phaseId('Módulo 101');
    await phaseId('Tema 1', m101);
    await addTask('Leer capítulo 1', m101);
    await app.inject({ method: 'DELETE', url: `${phasesUrl}/${m101}`, cookies: ana.cookies });

    const purged = await app.inject({
      method: 'DELETE',
      url: `${base(ws.id)}/trash/phase/${m101}`,
      cookies: ana.cookies,
    });
    expect(purged.statusCode).toBe(204);
    expect(await db.phase.count()).toBe(0);
    expect(await db.task.count()).toBe(0);
  });

  it('una tarea movida a otro proyecto queda suelta', async () => {
    const { ana, ws, projectId, phaseId, addTask } = await setup();
    const m101 = await phaseId('Módulo 101');
    const task = await addTask('Leer capítulo 1', m101);
    const other = await app.inject({
      method: 'POST',
      url: `${base(ws.id)}/projects`,
      cookies: ana.cookies,
      payload: { name: 'Otro' },
    });
    const moved = await app.inject({
      method: 'POST',
      url: `${base(ws.id)}/projects/${projectId}/tasks/${task.id}/move`,
      cookies: ana.cookies,
      payload: { targetWorkspaceId: ws.id, targetProjectId: other.json<{ id: string }>().id },
    });
    expect(moved.statusCode).toBe(204);
    const row = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(row.phaseId).toBeNull();
  });
});
