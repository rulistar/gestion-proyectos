import {
  myTaskListSchema,
  taskListSchema,
  taskSchema,
  workspaceTaskListSchema,
  type MembershipRole,
} from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { auditCreate, auditSoftDelete } from '../../db/audit.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createProject } from '../projects/projects.service.js';
import { createWorkspace } from '../workspaces/workspaces.service.js';
import { completedAtFor } from './tasks.service.js';

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
  sprint: null,
  sprintActivities: null,
  folio: null,
  description: null,
  requesterId: null,
  assignedToId: null,
  projectManagerId: null,
  consultingManagerId: null,
  businessPartnerId: null,
  area: null,
  classification: null,
  status: 'NOT_STARTED',
  priority: 'MEDIUM',
  startDate: null,
  endDate: null,
  notes: null,
} as const;

/** Workspace de Ana (Admin) con un proyecto, y miembros extra por rol */
async function setup() {
  const ana = await userWithSession(db, 'ana@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  const project = await createProject(db, ana.user.id, ws.id, { name: 'Curso', ...emptyProject });

  async function withRole(email: string, role: MembershipRole) {
    const user = await userWithSession(db, email);
    await addMember(db, ws.id, user.user.id, role);
    return user;
  }
  return { ana, ws, project, withRole };
}

/** Persona del catálogo vinculada a un usuario (HU-34); se crea si el miembro no la tiene */
async function personOf(workspaceId: string, userId: string) {
  const found = await db.person.findFirst({ where: { workspaceId, userId } });
  if (found) return found.id;
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const person = await db.person.create({
    data: { workspaceId, userId, name: user.name, ...auditCreate(null) },
  });
  return person.id;
}

/** ID de un tipo de tarea del catálogo del espacio, por nombre (HU-22) */
async function typeIdOf(workspaceId: string, name: string) {
  const type = await db.taskType.findFirstOrThrow({ where: { workspaceId, name } });
  return type.id;
}

const tasksUrl = (workspaceId: string, projectId: string) =>
  `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`;

function create(cookies: Cookies, workspaceId: string, projectId: string, payload: object) {
  return app.inject({ method: 'POST', url: tasksUrl(workspaceId, projectId), cookies, payload });
}

async function createOk(cookies: Cookies, workspaceId: string, projectId: string, payload: object) {
  const response = await create(cookies, workspaceId, projectId, payload);
  expect(response.statusCode).toBe(201);
  return taskSchema.parse(response.json());
}

function moveTo(cookies: Cookies, url: string, status: string) {
  return app.inject({ method: 'PATCH', url: `${url}/status`, cookies, payload: { status } });
}

describe('completedAtFor (regla de Hecha)', () => {
  const before = new Date('2026-10-01T10:00:00Z');
  const now = new Date('2026-10-24T10:00:00Z');

  it('al pasar a Hecha guarda la fecha actual', () => {
    expect(completedAtFor('DONE', { status: 'PENDING', completedAt: null }, now)).toEqual(now);
  });
  it('si ya estaba Hecha conserva la fecha original', () => {
    expect(completedAtFor('DONE', { status: 'DONE', completedAt: before }, now)).toEqual(before);
  });
  it('al salir de Hecha la vacía', () => {
    expect(completedAtFor('IN_PROGRESS', { status: 'DONE', completedAt: before }, now)).toBeNull();
  });
});

describe('autorización', () => {
  it('sin sesión 401; sin membresía 404', async () => {
    const { ws, project } = await setup();
    const luis = await userWithSession(db, 'luis@example.com');

    expect((await create({}, ws.id, project.id, { title: 'X' })).statusCode).toBe(401);
    expect((await create(luis.cookies, ws.id, project.id, { title: 'X' })).statusCode).toBe(404);
    const list = await app.inject({ url: tasksUrl(ws.id, project.id), cookies: luis.cookies });
    expect(list.statusCode).toBe(404);
    expect(await db.task.count()).toBe(0);
  });

  it('un Lector ve las tareas pero no puede crearlas ni moverlas (403)', async () => {
    const { ana, ws, project, withRole } = await setup();
    const lector = await withRole('lector@example.com', 'VIEWER');
    const task = await createOk(ana.cookies, ws.id, project.id, { title: 'Leer' });

    const list = await app.inject({ url: tasksUrl(ws.id, project.id), cookies: lector.cookies });
    const created = await create(lector.cookies, ws.id, project.id, { title: 'X' });
    const moved = await moveTo(lector.cookies, `${tasksUrl(ws.id, project.id)}/${task.id}`, 'DONE');

    expect(taskListSchema.parse(list.json())).toEqual([task]);
    expect(created.statusCode).toBe(403);
    expect(moved.statusCode).toBe(403);
  });

  it('un Miembro puede crear y mover tareas', async () => {
    const { ws, project, withRole } = await setup();
    const miembro = await withRole('miembro@example.com', 'MEMBER');

    const task = await createOk(miembro.cookies, ws.id, project.id, { title: 'Ejercicio' });
    const moved = await moveTo(
      miembro.cookies,
      `${tasksUrl(ws.id, project.id)}/${task.id}`,
      'IN_PROGRESS',
    );

    expect(moved.statusCode).toBe(200);
  });

  it('no deja usar un proyecto de otro workspace a través del mío (404)', async () => {
    const { ws, withRole } = await setup();
    const luis = await withRole('luis@example.com', 'MEMBER');
    const luisWs = await createWorkspace(db, luis.user.id, { name: 'De Luis' });
    const luisProject = await createProject(db, luis.user.id, luisWs.id, {
      name: 'Ajeno',
      ...emptyProject,
    });
    const luisTask = await createOk(luis.cookies, luisWs.id, luisProject.id, { title: 'Ajena' });

    // El proyecto y la tarea existen, pero en otro workspace
    const created = await create(luis.cookies, ws.id, luisProject.id, { title: 'X' });
    const moved = await moveTo(
      luis.cookies,
      `${tasksUrl(ws.id, luisProject.id)}/${luisTask.id}`,
      'DONE',
    );

    expect(created.statusCode).toBe(404);
    expect(moved.statusCode).toBe(404);
  });
});

describe('POST .../tasks (HU-08)', () => {
  it('crea la tarea con valores por defecto y registra quién la creó (RNF-01)', async () => {
    const { ana, ws, project } = await setup();

    const task = await createOk(ana.cookies, ws.id, project.id, {
      title: '  Ver la unidad 1 ',
      estimatedMinutes: '45',
      responsiblePersonId: '',
      endDate: '2026-11-20',
    });

    expect(task).toEqual({
      id: task.id,
      projectId: project.id,
      title: 'Ver la unidad 1',
      // Sin tipo pedido, el primero que admite el tipo del proyecto (HU-22)
      type: { id: task.type.id, name: 'Tarea', expedited: false },
      status: 'PENDING',
      estimatedMinutes: 45,
      responsible: null,
      startDate: null,
      endDate: '2026-11-20',
      completedAt: null,
      startedAt: null,
      statusReason: null,
    });
    const row = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(row).toMatchObject({ workspaceId: ws.id, createdById: ana.user.id });
  });

  it('el responsable es una persona del catálogo, con o sin cuenta (HU-35)', async () => {
    const { ana, ws, project, withRole } = await setup();
    const miembro = await withRole('miembro@example.com', 'MEMBER');
    const laura = await db.person.create({
      data: { workspaceId: ws.id, name: 'Laura (sin cuenta)', ...auditCreate(null) },
    });

    const withMember = await createOk(ana.cookies, ws.id, project.id, {
      title: 'Revisar',
      typeId: await typeIdOf(ws.id, 'Seguimiento'),
      responsiblePersonId: await personOf(ws.id, miembro.user.id),
    });
    const withoutAccount = await createOk(ana.cookies, ws.id, project.id, {
      title: 'Gestionar',
      typeId: await typeIdOf(ws.id, 'Gestión'),
      responsiblePersonId: laura.id,
    });

    expect(withMember).toMatchObject({
      type: { name: 'Seguimiento' },
      responsible: { name: 'miembro@example.com', hasAccess: true },
    });
    expect(withoutAccount).toMatchObject({
      type: { name: 'Gestión' },
      responsible: { name: 'Laura (sin cuenta)', userId: null, hasAccess: false },
    });
  });

  it('rechaza una persona de otro espacio (400)', async () => {
    const { ana, ws, project } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });

    const response = await create(ana.cookies, ws.id, project.id, {
      title: 'X',
      responsiblePersonId: await personOf(other.id, ana.user.id),
    });

    expect(response.statusCode).toBe(400);
    expect(await db.task.count()).toBe(0);
  });

  it('una tarea creada directamente como Hecha guarda completedAt', async () => {
    const { ana, ws, project } = await setup();

    const task = await createOk(ana.cookies, ws.id, project.id, {
      title: 'Ya hecha',
      status: 'DONE',
    });

    expect(task.completedAt).not.toBeNull();
  });

  it.each([
    ['sin título', { title: ' ' }],
    ['con minutos negativos', { title: 'X', estimatedMinutes: -5 }],
    ['con minutos no enteros', { title: 'X', estimatedMinutes: 1.5 }],
    ['con un tipo que no es un ID', { title: 'X', typeId: 'VIDEO' }],
    ['con fin antes del inicio', { title: 'X', startDate: '2026-11-10', endDate: '2026-11-01' }],
  ])('rechaza una tarea %s con 400', async (_caso, payload) => {
    const { ana, ws, project } = await setup();
    expect((await create(ana.cookies, ws.id, project.id, payload)).statusCode).toBe(400);
  });

  it('responde 404 si el proyecto está en la papelera', async () => {
    const { ana, ws, project } = await setup();
    await db.project.update({ where: { id: project.id }, data: auditSoftDelete(ana.user.id) });

    expect((await create(ana.cookies, ws.id, project.id, { title: 'X' })).statusCode).toBe(404);
  });
});

describe('GET .../tasks', () => {
  it('lista las tareas del proyecto sin las de la papelera ni las de otros proyectos', async () => {
    const { ana, ws, project } = await setup();
    const other = await createProject(db, ana.user.id, ws.id, { name: 'Otro', ...emptyProject });
    const kept = await createOk(ana.cookies, ws.id, project.id, { title: 'Activa' });
    const trashed = await createOk(ana.cookies, ws.id, project.id, { title: 'Borrada' });
    await createOk(ana.cookies, ws.id, other.id, { title: 'De otro proyecto' });
    await db.task.update({ where: { id: trashed.id }, data: auditSoftDelete(ana.user.id) });

    const response = await app.inject({ url: tasksUrl(ws.id, project.id), cookies: ana.cookies });

    expect(taskListSchema.parse(response.json())).toEqual([kept]);
  });
});

describe('mover y editar tareas', () => {
  it('PATCH status: al pasar a Hecha rellena completedAt y al salir lo vacía', async () => {
    const { ana, ws, project } = await setup();
    const task = await createOk(ana.cookies, ws.id, project.id, { title: 'Tarea' });
    const url = `${tasksUrl(ws.id, project.id)}/${task.id}`;

    const done = taskSchema.parse((await moveTo(ana.cookies, url, 'DONE')).json());
    const reopened = taskSchema.parse((await moveTo(ana.cookies, url, 'IN_PROGRESS')).json());

    expect(done).toMatchObject({ status: 'DONE', completedAt: expect.any(String) as string });
    expect(reopened).toMatchObject({ status: 'IN_PROGRESS', completedAt: null });
  });

  it('PATCH status rechaza un estado desconocido (400)', async () => {
    const { ana, ws, project } = await setup();
    const task = await createOk(ana.cookies, ws.id, project.id, { title: 'Tarea' });

    const response = await moveTo(
      ana.cookies,
      `${tasksUrl(ws.id, project.id)}/${task.id}`,
      'LATER',
    );

    expect(response.statusCode).toBe(400);
  });

  it('PUT reemplaza los datos y registra quién la modificó (RNF-01)', async () => {
    const { ana, ws, project, withRole } = await setup();
    const miembro = await withRole('miembro@example.com', 'MEMBER');
    const task = await createOk(ana.cookies, ws.id, project.id, { title: 'Original' });

    const response = await app.inject({
      method: 'PUT',
      url: `${tasksUrl(ws.id, project.id)}/${task.id}`,
      cookies: miembro.cookies,
      payload: {
        title: 'Editada',
        typeId: await typeIdOf(ws.id, 'Reunión'),
        estimatedMinutes: 30,
        responsiblePersonId: await personOf(ws.id, miembro.user.id),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      title: 'Editada',
      type: { name: 'Reunión' },
      estimatedMinutes: 30,
      responsible: { name: 'miembro@example.com' },
    });
    const row = await db.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(row).toMatchObject({ createdById: ana.user.id, updatedById: miembro.user.id });
  });

  it('responde 404 a una tarea en la papelera', async () => {
    const { ana, ws, project } = await setup();
    const task = await createOk(ana.cookies, ws.id, project.id, { title: 'Tarea' });
    await db.task.update({ where: { id: task.id }, data: auditSoftDelete(ana.user.id) });

    const response = await moveTo(ana.cookies, `${tasksUrl(ws.id, project.id)}/${task.id}`, 'DONE');

    expect(response.statusCode).toBe(404);
  });
});

describe('pausar y cancelar con motivo (HU-24)', () => {
  function moveWithReason(cookies: Cookies, url: string, status: string, statusReason?: string) {
    return app.inject({
      method: 'PATCH',
      url: `${url}/status`,
      cookies,
      payload: { status, statusReason },
    });
  }

  it.each(['PAUSED', 'CANCELLED'])(
    '%s sin motivo responde 400 y la tarea no cambia',
    async (status) => {
      const { ana, ws, project } = await setup();
      const task = await createOk(ana.cookies, ws.id, project.id, { title: 'Tarea' });
      const url = `${tasksUrl(ws.id, project.id)}/${task.id}`;

      const response = await moveWithReason(ana.cookies, url, status, '   ');

      expect(response.statusCode).toBe(400);
      expect(response.json<{ message: string }>().message).toContain('motivo');
      const row = await db.task.findUniqueOrThrow({ where: { id: task.id } });
      expect(row.status).toBe('PENDING');
    },
  );

  it('pausar guarda el motivo; reactivar lo limpia', async () => {
    const { ana, ws, project } = await setup();
    const task = await createOk(ana.cookies, ws.id, project.id, { title: 'Tarea' });
    const url = `${tasksUrl(ws.id, project.id)}/${task.id}`;

    const paused = taskSchema.parse(
      (await moveWithReason(ana.cookies, url, 'PAUSED', ' Esperando al cliente ')).json(),
    );
    const resumed = taskSchema.parse(
      (await moveWithReason(ana.cookies, url, 'IN_PROGRESS', 'texto que se ignora')).json(),
    );

    expect(paused).toMatchObject({ status: 'PAUSED', statusReason: 'Esperando al cliente' });
    expect(resumed).toMatchObject({ status: 'IN_PROGRESS', statusReason: null });
  });

  it('una tarea cancelada se puede reabrir', async () => {
    const { ana, ws, project } = await setup();
    const task = await createOk(ana.cookies, ws.id, project.id, { title: 'Tarea' });
    const url = `${tasksUrl(ws.id, project.id)}/${task.id}`;

    await moveWithReason(ana.cookies, url, 'CANCELLED', 'Ya no se necesita');
    const reopened = await moveWithReason(ana.cookies, url, 'PENDING');

    expect(reopened.json()).toMatchObject({ status: 'PENDING', statusReason: null });
  });

  it('crear o editar en Pausada también exige motivo', async () => {
    const { ana, ws, project } = await setup();

    const withoutReason = await create(ana.cookies, ws.id, project.id, {
      title: 'X',
      status: 'PAUSED',
    });
    const withReason = await create(ana.cookies, ws.id, project.id, {
      title: 'X',
      status: 'PAUSED',
      statusReason: 'Falta presupuesto',
    });

    expect(withoutReason.statusCode).toBe(400);
    expect(withReason.statusCode).toBe(201);
  });

  it('el avance del proyecto descuenta las canceladas y cuenta las pausadas', async () => {
    const { ana, ws, project } = await setup();
    const base = { title: 'T' };
    await createOk(ana.cookies, ws.id, project.id, {
      ...base,
      status: 'DONE',
      estimatedMinutes: 30,
    });
    await createOk(ana.cookies, ws.id, project.id, {
      ...base,
      status: 'PAUSED',
      statusReason: 'Esperando',
      estimatedMinutes: 45,
    });
    await createOk(ana.cookies, ws.id, project.id, {
      ...base,
      status: 'CANCELLED',
      statusReason: 'Fuera de alcance',
      estimatedMinutes: 500,
    });

    const response = await app.inject({
      url: `/api/v1/workspaces/${ws.id}/projects/${project.id}`,
      cookies: ana.cookies,
    });

    expect(response.json()).toMatchObject({
      progress: { totalTasks: 2, doneTasks: 1, percent: 50, pendingMinutes: 45 },
    });
  });
});

describe('persona que ya no es miembro (HU-25 con personas, HU-35)', () => {
  it('la tarea conserva a la persona, marcada sin acceso; se puede editar sin reasignar', async () => {
    const { ana, ws, project, withRole } = await setup();
    const luis = await withRole('luis@example.com', 'MEMBER');
    const luisPerson = await personOf(ws.id, luis.user.id);
    const task = await createOk(ana.cookies, ws.id, project.id, {
      title: 'De Luis',
      responsiblePersonId: luisPerson,
    });

    await app.inject({
      method: 'DELETE',
      url: `/api/v1/workspaces/${ws.id}/members/${luis.user.id}`,
      cookies: ana.cookies,
    });
    const list = taskListSchema.parse(
      (await app.inject({ url: tasksUrl(ws.id, project.id), cookies: ana.cookies })).json(),
    );
    const edited = await app.inject({
      method: 'PUT',
      url: `${tasksUrl(ws.id, project.id)}/${task.id}`,
      cookies: ana.cookies,
      payload: { title: 'Renombrada', responsiblePersonId: luisPerson },
    });

    expect(list[0]?.responsible).toMatchObject({
      id: luisPerson,
      name: 'luis@example.com',
      hasAccess: false,
    });
    expect(edited.statusCode).toBe(200);
  });

  it('una persona archivada no se asigna a tareas nuevas (400), pero se conserva al editar', async () => {
    const { ana, ws, project } = await setup();
    const laura = await db.person.create({
      data: { workspaceId: ws.id, name: 'Laura', ...auditCreate(null) },
    });
    const task = await createOk(ana.cookies, ws.id, project.id, {
      title: 'Con Laura',
      responsiblePersonId: laura.id,
    });
    await db.person.update({ where: { id: laura.id }, data: { archivedAt: new Date() } });

    const fresh = await create(ana.cookies, ws.id, project.id, {
      title: 'Nueva',
      responsiblePersonId: laura.id,
    });
    const kept = await app.inject({
      method: 'PUT',
      url: `${tasksUrl(ws.id, project.id)}/${task.id}`,
      cookies: ana.cookies,
      payload: { title: 'Sigue con Laura', responsiblePersonId: laura.id },
    });

    expect(fresh.statusCode).toBe(400);
    expect(kept.statusCode).toBe(200);
  });
});

describe('mi trabajo (HU-28b)', () => {
  const myTasksUrl = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}/my-tasks`;

  it('devuelve solo mis tareas abiertas y hechas recientes, con su proyecto', async () => {
    const { ana, ws, project, withRole } = await setup();
    const luis = await withRole('luis@example.com', 'MEMBER');
    const url = tasksUrl(ws.id, project.id);
    const mine = { responsiblePersonId: await personOf(ws.id, ana.user.id) };
    await createOk(ana.cookies, ws.id, project.id, { title: 'Pendiente', ...mine });
    await createOk(ana.cookies, ws.id, project.id, { title: 'Hecha', status: 'DONE', ...mine });
    await createOk(ana.cookies, ws.id, project.id, {
      title: 'Cancelada',
      status: 'CANCELLED',
      statusReason: 'Ya no aplica',
      ...mine,
    });
    await createOk(ana.cookies, ws.id, project.id, {
      title: 'De Luis',
      responsiblePersonId: await personOf(ws.id, luis.user.id),
    });
    await createOk(ana.cookies, ws.id, project.id, { title: 'Sin asignar' });
    const trashed = await createOk(ana.cookies, ws.id, project.id, { title: 'Borrada', ...mine });
    await app.inject({ method: 'DELETE', url: `${url}/${trashed.id}`, cookies: ana.cookies });

    const response = await app.inject({ url: myTasksUrl(ws.id), cookies: ana.cookies });

    expect(response.statusCode).toBe(200);
    const tasks = myTaskListSchema.parse(response.json());
    expect(tasks.map((t) => t.title).sort()).toEqual(['Hecha', 'Pendiente']);
    expect(tasks[0]!.projectName).toBe('Curso');
  });

  it('las hechas antes de doneSince no se incluyen; un doneSince inválido da 400', async () => {
    const { ana, ws, project } = await setup();
    await createOk(ana.cookies, ws.id, project.id, {
      title: 'Hecha',
      status: 'DONE',
      responsiblePersonId: await personOf(ws.id, ana.user.id),
    });

    const future = new Date(Date.now() + 60_000).toISOString();
    const later = await app.inject({
      url: `${myTasksUrl(ws.id)}?doneSince=${future}`,
      cookies: ana.cookies,
    });
    const invalid = await app.inject({
      url: `${myTasksUrl(ws.id)}?doneSince=ayer`,
      cookies: ana.cookies,
    });

    expect(myTaskListSchema.parse(later.json())).toEqual([]);
    expect(invalid.statusCode).toBe(400);
  });

  it('las tareas de un proyecto en la papelera no aparecen; quien no es miembro recibe 404', async () => {
    const { ana, ws, project } = await setup();
    await createOk(ana.cookies, ws.id, project.id, {
      title: 'X',
      responsiblePersonId: await personOf(ws.id, ana.user.id),
    });
    await db.project.update({ where: { id: project.id }, data: auditSoftDelete(ana.user.id) });
    const outsider = await userWithSession(db, 'otro@example.com');

    const mine = await app.inject({ url: myTasksUrl(ws.id), cookies: ana.cookies });
    const theirs = await app.inject({ url: myTasksUrl(ws.id), cookies: outsider.cookies });

    expect(mine.json()).toEqual([]);
    expect(theirs.statusCode).toBe(404);
  });
});

describe('vista Tareas (HU-39)', () => {
  const allTasksUrl = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}/tasks`;

  it('devuelve las tareas de todos los contenedores con su proyecto, por fecha de fin', async () => {
    const { ana, ws, project, withRole } = await setup();
    const lector = await withRole('lector@example.com', 'VIEWER');
    const other = await createProject(db, ana.user.id, ws.id, {
      name: 'ERP',
      ...emptyProject,
      folio: 'PY2610-009',
    });
    await createOk(ana.cookies, ws.id, project.id, { title: 'Sin fecha' });
    await createOk(ana.cookies, ws.id, other.id, { title: 'Tarde', endDate: '2026-11-20' });
    await createOk(ana.cookies, ws.id, project.id, {
      title: 'Hecha',
      status: 'DONE',
      endDate: '2026-11-01',
    });
    const trashed = await createOk(ana.cookies, ws.id, other.id, { title: 'Borrada' });
    await app.inject({
      method: 'DELETE',
      url: `${tasksUrl(ws.id, other.id)}/${trashed.id}`,
      cookies: ana.cookies,
    });

    // También un Lector la puede consultar
    const response = await app.inject({ url: allTasksUrl(ws.id), cookies: lector.cookies });

    expect(response.statusCode).toBe(200);
    const tasks = workspaceTaskListSchema.parse(response.json());
    expect(tasks.map((t) => t.title)).toEqual(['Hecha', 'Tarde', 'Sin fecha']);
    expect(tasks[1]!.project).toMatchObject({ name: 'ERP', folio: 'PY2610-009' });
    expect(tasks[1]!.project.type.behavior).toBe('WITH_END');
  });

  it('no incluye contenedores en la papelera ni de otro espacio; quien no es miembro recibe 404', async () => {
    const { ana, ws, project } = await setup();
    await createOk(ana.cookies, ws.id, project.id, { title: 'X' });
    await db.project.update({ where: { id: project.id }, data: auditSoftDelete(ana.user.id) });
    const otherWs = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const foreign = await createProject(db, ana.user.id, otherWs.id, {
      name: 'Ajeno',
      ...emptyProject,
    });
    await createOk(ana.cookies, otherWs.id, foreign.id, { title: 'De otro espacio' });
    const outsider = await userWithSession(db, 'otro@example.com');

    const mine = await app.inject({ url: allTasksUrl(ws.id), cookies: ana.cookies });
    const theirs = await app.inject({ url: allTasksUrl(ws.id), cookies: outsider.cookies });

    expect(mine.json()).toEqual([]);
    expect(theirs.statusCode).toBe(404);
  });
});
