import { projectListSchema, taskListSchema, trashListSchema } from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createProject } from '../projects/projects.service.js';
import { createTask } from '../tasks/tasks.service.js';
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

const emptyProject = {
  typeId: null,
  folio: null,
  description: null,
  requester: null,
  assignedTo: null,
  projectManager: null,
  consultingManager: null,
  businessPartner: null,
  area: null,
  classification: null,
  status: 'NOT_STARTED',
  priority: 'MEDIUM',
  startDate: null,
  endDate: null,
  notes: null,
} as const;

const emptyTask = {
  type: 'TASK',
  status: 'PENDING',
  estimatedMinutes: null,
  assigneeId: null,
  startDate: null,
  endDate: null,
  statusReason: null,
} as const;

/** Workspace de Ana (Admin) con un proyecto de dos tareas, y Mario (Miembro) */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const mario = await userWithSession(db, 'mario@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  await addMember(db, ws.id, mario.user.id, 'MEMBER');
  const project = await createProject(db, ana.user.id, ws.id, { name: 'Curso', ...emptyProject });
  const task = await createTask(db, ana.user.id, ws.id, project.id, {
    title: 'Leer',
    ...emptyTask,
  });
  await createTask(db, ana.user.id, ws.id, project.id, { title: 'Escribir', ...emptyTask });
  return { ana, mario, ws, project, task };
}

const projectUrl = (ws: string, project: string) => `/api/v1/workspaces/${ws}/projects/${project}`;
const taskUrl = (ws: string, project: string, task: string) =>
  `${projectUrl(ws, project)}/tasks/${task}`;
const trashUrl = (ws: string) => `/api/v1/workspaces/${ws}/trash`;

function remove(cookies: Cookies, url: string) {
  return app.inject({ method: 'DELETE', url, cookies });
}

function restore(cookies: Cookies, ws: string, kind: string, id: string) {
  return app.inject({ method: 'POST', url: `${trashUrl(ws)}/${kind}/${id}/restore`, cookies });
}

async function trash(cookies: Cookies, ws: string) {
  const response = await app.inject({ url: trashUrl(ws), cookies });
  expect(response.statusCode).toBe(200);
  return trashListSchema.parse(response.json());
}

async function projects(cookies: Cookies, ws: string) {
  const response = await app.inject({ url: `/api/v1/workspaces/${ws}/projects`, cookies });
  return projectListSchema.parse(response.json());
}

describe('dar de baja (HU-15)', () => {
  it('el Admin da de baja un proyecto: deja de verse con sus tareas y registra quién (RNF-01)', async () => {
    const { ana, ws, project } = await setup();

    expect((await remove(ana.cookies, projectUrl(ws.id, project.id))).statusCode).toBe(204);

    expect(await projects(ana.cookies, ws.id)).toEqual([]);
    const detail = await app.inject({ url: projectUrl(ws.id, project.id), cookies: ana.cookies });
    expect(detail.statusCode).toBe(404);
    const tasks = await app.inject({
      url: `${projectUrl(ws.id, project.id)}/tasks`,
      cookies: ana.cookies,
    });
    expect(tasks.statusCode).toBe(404);
    const row = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(row.deletedById).toBe(ana.user.id);
    expect(row.deletedAt).not.toBeNull();
  });

  it('un Miembro no puede dar de baja proyectos (403), pero sí tareas', async () => {
    const { mario, ws, project, task } = await setup();

    expect((await remove(mario.cookies, projectUrl(ws.id, project.id))).statusCode).toBe(403);
    expect((await remove(mario.cookies, taskUrl(ws.id, project.id, task.id))).statusCode).toBe(204);
  });

  it('la tarea dada de baja deja de verse y no cuenta en el avance', async () => {
    const { ana, ws, project, task } = await setup();

    await remove(ana.cookies, taskUrl(ws.id, project.id, task.id));

    const response = await app.inject({
      url: `${projectUrl(ws.id, project.id)}/tasks`,
      cookies: ana.cookies,
    });
    expect(taskListSchema.parse(response.json()).map((t) => t.title)).toEqual(['Escribir']);
    expect((await projects(ana.cookies, ws.id))[0]!.progress.totalTasks).toBe(1);
  });

  it('dar de baja dos veces, o desde otro workspace, responde 404', async () => {
    const { ana, ws, project } = await setup();
    const otherWs = await createWorkspace(db, ana.user.id, { name: 'Otro' });

    expect((await remove(ana.cookies, projectUrl(otherWs.id, project.id))).statusCode).toBe(404);
    await remove(ana.cookies, projectUrl(ws.id, project.id));
    expect((await remove(ana.cookies, projectUrl(ws.id, project.id))).statusCode).toBe(404);
  });
});

describe('papelera', () => {
  it('solo el Admin la ve (un Miembro recibe 403)', async () => {
    const { mario, ws } = await setup();
    const response = await app.inject({ url: trashUrl(ws.id), cookies: mario.cookies });
    expect(response.statusCode).toBe(403);
  });

  it('lista qué se dio de baja, quién y cuándo; las tareas del proyecto borrado van con él', async () => {
    const { ana, ws, project, task } = await setup();
    const second = await createProject(db, ana.user.id, ws.id, { name: 'Taller', ...emptyProject });
    const loose = await createTask(db, ana.user.id, ws.id, second.id, {
      title: 'Suelta',
      ...emptyTask,
    });

    await remove(ana.cookies, taskUrl(ws.id, project.id, task.id));
    await remove(ana.cookies, projectUrl(ws.id, project.id));
    await remove(ana.cookies, taskUrl(ws.id, second.id, loose.id));

    const items = await trash(ana.cookies, ws.id);
    expect(items.map((i) => [i.kind, i.name, i.projectName, i.taskCount])).toEqual([
      ['task', 'Suelta', 'Taller', 0],
      // "Leer" ya estaba en la papelera: no vuelve con el proyecto, así que no cuenta
      ['project', 'Curso', null, 1],
    ]);
    expect(items[0]!.deletedByName).toBe('ana@example.com');
  });

  it('restaurar un proyecto lo devuelve con sus tareas', async () => {
    const { ana, ws, project } = await setup();
    await remove(ana.cookies, projectUrl(ws.id, project.id));

    expect((await restore(ana.cookies, ws.id, 'project', project.id)).statusCode).toBe(204);

    const [restored] = await projects(ana.cookies, ws.id);
    expect(restored!.progress.totalTasks).toBe(2);
    expect(await trash(ana.cookies, ws.id)).toEqual([]);
    const row = await db.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(row.deletedById).toBeNull();
    expect(row.updatedById).toBe(ana.user.id);
  });

  it('restaurar una tarea la devuelve a su proyecto', async () => {
    const { ana, ws, project, task } = await setup();
    await remove(ana.cookies, taskUrl(ws.id, project.id, task.id));

    expect((await restore(ana.cookies, ws.id, 'task', task.id)).statusCode).toBe(204);
    expect((await projects(ana.cookies, ws.id))[0]!.progress.totalTasks).toBe(2);
  });

  it('borrar definitivamente un proyecto se lleva sus tareas', async () => {
    const { ana, ws, project } = await setup();
    await remove(ana.cookies, projectUrl(ws.id, project.id));

    const response = await remove(ana.cookies, `${trashUrl(ws.id)}/project/${project.id}`);

    expect(response.statusCode).toBe(204);
    expect(await db.project.count()).toBe(0);
    expect(await db.task.count()).toBe(0);
  });

  it('solo se borra definitivamente lo que está en la papelera (404 si no)', async () => {
    const { ana, ws, project, task } = await setup();

    for (const path of [`project/${project.id}`, `task/${task.id}`, `otro/${task.id}`]) {
      expect((await remove(ana.cookies, `${trashUrl(ws.id)}/${path}`)).statusCode).toBe(404);
    }
    expect(await db.task.count()).toBe(2);
  });

  it('un Miembro no puede restaurar ni borrar definitivamente (403)', async () => {
    const { ana, mario, ws, project } = await setup();
    await remove(ana.cookies, projectUrl(ws.id, project.id));

    expect((await restore(mario.cookies, ws.id, 'project', project.id)).statusCode).toBe(403);
    const purge = await remove(mario.cookies, `${trashUrl(ws.id)}/project/${project.id}`);
    expect(purge.statusCode).toBe(403);
    expect(await db.project.count()).toBe(1);
  });
});
