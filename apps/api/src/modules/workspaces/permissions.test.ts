import {
  memberListSchema,
  PERMISSION_TEMPLATES,
  projectListSchema,
  taskListSchema,
  trashListSchema,
  workspaceTaskListSchema,
  type MemberPermissions,
} from '@gestion/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { auditCreate } from '../../db/audit.js';
import { createTestDb, resetDb } from '../../test/test-db.js';
import { addMember, userWithSession } from '../../test/users.js';
import { createProject } from '../projects/projects.service.js';
import { createTask } from '../tasks/tasks.service.js';
import { createWorkspace } from './workspaces.service.js';

/** Permisos por persona (ADR-0006, HU-17a): cada endpoint respeta la matriz */

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
  scope: 'WORK',
  area: null,
  classification: null,
  status: 'NOT_STARTED',
  priority: 'MEDIUM',
  startDate: null,
  endDate: null,
  notes: null,
} as const;

const emptyTask = {
  typeId: null,
  status: 'PENDING',
  estimatedMinutes: null,
  responsiblePersonId: null,
  startDate: null,
  endDate: null,
  statusReason: null,
  originId: null,
  originDetail: null,
} as const;

const MEMBER = PERMISSION_TEMPLATES.MEMBER;

/**
 * Espacio de Ana (Admin) con dos proyectos suyos: "Portal" (donde Juan tiene una tarea asignada)
 * y "ERP" (sin nada de Juan). Juan entra con la matriz indicada (por omisión, la plantilla Miembro).
 */
async function setup(permissions: MemberPermissions = MEMBER) {
  const ana = await userWithSession(db, 'ana@example.com');
  const juan = await userWithSession(db, 'juan@example.com');
  const ws = await createWorkspace(db, ana.user.id, { name: 'Equipo' });
  const membership = await addMember(db, ws.id, juan.user.id, 'MEMBER', permissions);
  const juanPerson = await db.person.create({
    data: { workspaceId: ws.id, userId: juan.user.id, name: 'Juan', ...auditCreate(null) },
  });
  const portal = await createProject(db, ana.user.id, ws.id, { name: 'Portal', ...emptyProject });
  const erp = await createProject(db, ana.user.id, ws.id, { name: 'ERP', ...emptyProject });
  const assigned = await createTask(db, ana.user.id, ws.id, portal.id, {
    ...emptyTask,
    title: 'Asignada a Juan',
    responsiblePersonId: juanPerson.id,
  });
  const anasTask = await createTask(db, ana.user.id, ws.id, portal.id, {
    ...emptyTask,
    title: 'De Ana',
  });
  return { ana, juan, ws, membership, portal, erp, assigned, anasTask };
}

const base = (ws: string) => `/api/v1/workspaces/${ws}`;
const projectUrl = (ws: string, project: string) => `${base(ws)}/projects/${project}`;
const tasksUrl = (ws: string, project: string) => `${projectUrl(ws, project)}/tasks`;

function get(cookies: Cookies, url: string) {
  return app.inject({ url, cookies });
}

function send(
  cookies: Cookies,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  payload?: object,
) {
  return app.inject({ method, url, cookies, ...(payload && { payload }) });
}

async function projectNames(cookies: Cookies, ws: string) {
  const response = await get(cookies, `${base(ws)}/projects`);
  return projectListSchema
    .parse(response.json())
    .map((p) => p.name)
    .sort();
}

async function typeId(ws: string, behavior: 'WITH_END' | 'ONGOING' | 'ON_DEMAND') {
  const type = await db.projectType.findFirstOrThrow({ where: { workspaceId: ws, behavior } });
  return type.id;
}

describe('plantilla Miembro: ve lo que creó y las tareas de donde tiene una suya', () => {
  it('ve solo el contenedor donde tiene una tarea (solo lectura); el resto da 404', async () => {
    const { juan, ws, portal, erp } = await setup();

    expect(await projectNames(juan.cookies, ws.id)).toEqual(['Portal']);
    expect((await get(juan.cookies, projectUrl(ws.id, portal.id))).statusCode).toBe(200);
    expect((await get(juan.cookies, projectUrl(ws.id, erp.id))).statusCode).toBe(404);
    // Lo ve, pero no es suyo: no lo modifica ni lo da de baja
    const edit = await send(juan.cookies, 'PUT', projectUrl(ws.id, portal.id), {
      ...emptyProject,
      name: 'Cambiado',
    });
    expect(edit.statusCode).toBe(403);
    expect((await send(juan.cookies, 'DELETE', projectUrl(ws.id, portal.id))).statusCode).toBe(403);
  });

  it('en ese contenedor ve todas las tareas (HU-53), pero solo modifica las suyas', async () => {
    const { juan, ws, portal, assigned, anasTask } = await setup();

    const list = taskListSchema.parse((await get(juan.cookies, tasksUrl(ws.id, portal.id))).json());
    expect(list.map((t) => t.title).sort()).toEqual(['Asignada a Juan', 'De Ana']);

    const mine = await send(
      juan.cookies,
      'PATCH',
      `${tasksUrl(ws.id, portal.id)}/${assigned.id}/status`,
      {
        status: 'IN_PROGRESS',
      },
    );
    expect(mine.statusCode).toBe(200);
    const others = await send(
      juan.cookies,
      'PATCH',
      `${tasksUrl(ws.id, portal.id)}/${anasTask.id}/status`,
      {
        status: 'IN_PROGRESS',
      },
    );
    expect(others.statusCode).toBe(403);
    // Dar de baja: la plantilla Miembro no lo permite ni con las suyas
    const remove = await send(
      juan.cookies,
      'DELETE',
      `${tasksUrl(ws.id, portal.id)}/${assigned.id}`,
    );
    expect(remove.statusCode).toBe(403);
  });

  it('agrega tareas donde tiene una suya; no crea contenedores', async () => {
    const { juan, ws, portal, erp } = await setup();

    const created = await send(juan.cookies, 'POST', tasksUrl(ws.id, portal.id), {
      title: 'Nueva',
    });
    expect(created.statusCode).toBe(201);
    expect(
      (await send(juan.cookies, 'POST', tasksUrl(ws.id, erp.id), { title: 'X' })).statusCode,
    ).toBe(404);
    const project = await send(juan.cookies, 'POST', `${base(ws.id)}/projects`, {
      ...emptyProject,
      name: 'Mío',
    });
    expect(project.statusCode).toBe(403);
  });

  it('la vista Tareas muestra las de los contenedores que ve (HU-53)', async () => {
    const { juan, ws, portal } = await setup();
    await send(juan.cookies, 'POST', tasksUrl(ws.id, portal.id), { title: 'Creada por Juan' });

    const response = await get(juan.cookies, `${base(ws.id)}/tasks`);
    const titles = workspaceTaskListSchema
      .parse(response.json())
      .map((t) => t.title)
      .sort();
    expect(titles).toEqual(['Asignada a Juan', 'Creada por Juan', 'De Ana']);
  });
});

describe('matriz ajustada', () => {
  it('crea actividades si su matriz lo dice, y ve y modifica lo que creó', async () => {
    const permissions: MemberPermissions = {
      ...MEMBER,
      sections: { ...MEMBER.sections, ON_DEMAND: { ...MEMBER.sections.ON_DEMAND, create: true } },
    };
    const { juan, ws } = await setup(permissions);
    const activities = await typeId(ws.id, 'ON_DEMAND');

    const created = await send(juan.cookies, 'POST', `${base(ws.id)}/projects`, {
      ...emptyProject,
      name: 'Pendientes de Juan',
      typeId: activities,
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();
    const edit = await send(juan.cookies, 'PUT', projectUrl(ws.id, id), {
      ...emptyProject,
      typeId: activities,
      name: 'Renombrado',
    });
    expect(edit.statusCode).toBe(200);
    // Proyectos sigue sin permitirle crear
    const project = await send(juan.cookies, 'POST', `${base(ws.id)}/projects`, {
      ...emptyProject,
      name: 'Proyecto',
      typeId: await typeId(ws.id, 'WITH_END'),
    });
    expect(project.statusCode).toBe(403);
  });

  it('"Estos…": ve los contenedores de su lista y, con "Modificar los que ve", los edita', async () => {
    const permissions: MemberPermissions = {
      ...MEMBER,
      sections: {
        ...MEMBER.sections,
        WITH_END: { view: 'SELECTED', create: false, update: 'VISIBLE', remove: 'NONE' },
      },
    };
    const { juan, ws, membership, erp } = await setup(permissions);
    await db.membershipProjectAccess.create({
      data: { membershipId: membership.id, projectId: erp.id },
    });

    expect(await projectNames(juan.cookies, ws.id)).toEqual(['ERP', 'Portal']);
    const edit = await send(juan.cookies, 'PUT', projectUrl(ws.id, erp.id), {
      ...emptyProject,
      name: 'ERP 2',
    });
    expect(edit.statusCode).toBe(200);
  });

  it('ver todos sin modificar = solo lectura; con "ver todas las tareas" ve las de otros', async () => {
    const permissions: MemberPermissions = {
      sections: {
        ...MEMBER.sections,
        WITH_END: { view: 'ALL', create: false, update: 'NONE', remove: 'NONE' },
      },
      tasks: { ...MEMBER.tasks, view: 'VISIBLE' },
      workOnly: false,
    };
    const { juan, ws, portal, erp, anasTask } = await setup(permissions);

    expect(await projectNames(juan.cookies, ws.id)).toEqual(['ERP', 'Portal']);
    const edit = await send(juan.cookies, 'PUT', projectUrl(ws.id, erp.id), {
      ...emptyProject,
      name: 'X',
    });
    expect(edit.statusCode).toBe(403);
    const list = taskListSchema.parse((await get(juan.cookies, tasksUrl(ws.id, portal.id))).json());
    expect(list).toHaveLength(2);
    // La ve, pero modificar sigue siendo "las mías"
    const others = await send(
      juan.cookies,
      'PATCH',
      `${tasksUrl(ws.id, portal.id)}/${anasTask.id}/status`,
      {
        status: 'DONE',
      },
    );
    expect(others.statusCode).toBe(403);
  });

  it('da de baja y restaura lo suyo; borrar definitivamente sigue siendo del Admin', async () => {
    const permissions: MemberPermissions = {
      ...MEMBER,
      tasks: { ...MEMBER.tasks, remove: 'MINE' },
    };
    const { juan, ws, portal, assigned } = await setup(permissions);
    const taskUrl = `${tasksUrl(ws.id, portal.id)}/${assigned.id}`;

    expect((await send(juan.cookies, 'DELETE', taskUrl)).statusCode).toBe(204);
    const trash = trashListSchema.parse((await get(juan.cookies, `${base(ws.id)}/trash`)).json());
    expect(trash.map((i) => i.name)).toEqual(['Asignada a Juan']);
    const purge = await send(juan.cookies, 'DELETE', `${base(ws.id)}/trash/task/${assigned.id}`);
    expect(purge.statusCode).toBe(403);
    const restore = await send(
      juan.cookies,
      'POST',
      `${base(ws.id)}/trash/task/${assigned.id}/restore`,
    );
    expect(restore.statusCode).toBe(204);
  });
});

describe('otras rutas', () => {
  it('un Lector no modifica ni sus tareas asignadas, ni da de alta personas', async () => {
    const { juan, ws, portal, assigned } = await setup(PERMISSION_TEMPLATES.VIEWER);

    const status = await send(
      juan.cookies,
      'PATCH',
      `${tasksUrl(ws.id, portal.id)}/${assigned.id}/status`,
      {
        status: 'DONE',
      },
    );
    expect(status.statusCode).toBe(403);
    const person = await send(juan.cookies, 'POST', `${base(ws.id)}/people`, { name: 'Alguien' });
    expect(person.statusCode).toBe(403);
  });

  it('no puede mover su tarea a un contenedor que no ve', async () => {
    const { juan, ws, portal, erp, assigned } = await setup();

    const move = await send(
      juan.cookies,
      'POST',
      `${tasksUrl(ws.id, portal.id)}/${assigned.id}/move`,
      {
        targetWorkspaceId: ws.id,
        targetProjectId: erp.id,
      },
    );
    expect(move.statusCode).toBe(404);
  });

  it('el Admin sigue viendo y modificando todo', async () => {
    const { ana, ws, portal, assigned } = await setup();

    expect(await projectNames(ana.cookies, ws.id)).toEqual(['ERP', 'Portal']);
    const status = await send(
      ana.cookies,
      'PATCH',
      `${tasksUrl(ws.id, portal.id)}/${assigned.id}/status`,
      {
        status: 'DONE',
      },
    );
    expect(status.statusCode).toBe(200);
  });
});

describe('pantalla de permisos (HU-17b)', () => {
  // Copia profunda sin referencias compartidas: en la plantilla, las tres secciones son el mismo objeto
  const copyOf = (permissions: MemberPermissions) =>
    JSON.parse(JSON.stringify(permissions)) as MemberPermissions;

  async function containerOf(
    owner: { user: { id: string } },
    workspaceId: string,
    behavior: 'WITH_END' | 'ONGOING',
    name: string,
  ) {
    const type = await db.projectType.findFirstOrThrow({ where: { workspaceId, behavior } });
    const project = await createProject(db, owner.user.id, workspaceId, {
      ...emptyProject,
      name,
      typeId: type.id,
    });
    return project.id;
  }

  const permissionsUrl = (ws: string, userId: string) =>
    `/api/v1/workspaces/${ws}/members/${userId}/permissions`;

  function putPermissions(cookies: Cookies, ws: string, userId: string, payload: object) {
    return app.inject({ method: 'PUT', url: permissionsUrl(ws, userId), cookies, payload });
  }

  async function matrixOf(cookies: Cookies, ws: string, userId: string) {
    const response = await app.inject({ url: `/api/v1/workspaces/${ws}/members`, cookies });
    return memberListSchema.parse(response.json()).find((m) => m.userId === userId)!;
  }

  it('el Admin ajusta la matriz y "Estos…": se guarda solo lo de secciones que ven "Estos…"', async () => {
    const { ana, juan, ws } = await setup();
    const proyecto = await containerOf(ana, ws.id, 'WITH_END', 'Proyecto A');
    const mtto = await containerOf(ana, ws.id, 'ONGOING', 'Mtto B');
    const permissions = copyOf(PERMISSION_TEMPLATES.MEMBER);
    permissions.sections.WITH_END.view = 'SELECTED';
    permissions.tasks.remove = 'MINE';

    const response = await putPermissions(ana.cookies, ws.id, juan.user.id, {
      role: 'MEMBER',
      permissions,
      // El mantenimiento no cuenta: Mantenimientos ve "solo los míos"
      selectedProjectIds: [proyecto, mtto],
    });

    expect(response.statusCode).toBe(204);
    expect((await matrixOf(ana.cookies, ws.id, juan.user.id)).matrix).toEqual({
      permissions,
      selectedProjectIds: [proyecto],
      watchedPersonIds: [],
    });
    // Y la API ya lo aplica: Juan ve el proyecto elegido
    const list = await app.inject({
      url: `/api/v1/workspaces/${ws.id}/projects`,
      cookies: juan.cookies,
    });
    const names = projectListSchema.parse(list.json()).map((p) => p.name);
    expect(names).toContain('Proyecto A');
    expect(names).not.toContain('ERP');
  });

  it('cambiar el rol aplica la plantilla y borra los ajustes', async () => {
    const { ana, juan, ws } = await setup();

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/workspaces/${ws.id}/members/${juan.user.id}`,
      cookies: ana.cookies,
      payload: { role: 'MEMBER' },
    });

    expect(response.statusCode).toBe(204);
    expect((await matrixOf(ana.cookies, ws.id, juan.user.id)).matrix?.permissions).toEqual(
      PERMISSION_TEMPLATES.MEMBER,
    );
  });

  it('con plantilla Admin se ignora la matriz; no se queda el espacio sin Admin (409)', async () => {
    const { ana, juan, ws } = await setup();
    const body = { permissions: PERMISSION_TEMPLATES.VIEWER, selectedProjectIds: [] };

    await putPermissions(ana.cookies, ws.id, juan.user.id, { role: 'ADMIN', ...body });
    expect((await matrixOf(ana.cookies, ws.id, juan.user.id)).matrix?.permissions).toEqual(
      PERMISSION_TEMPLATES.ADMIN,
    );
    await putPermissions(ana.cookies, ws.id, juan.user.id, { role: 'VIEWER', ...body });
    const last = await putPermissions(ana.cookies, ws.id, ana.user.id, { role: 'MEMBER', ...body });
    expect(last.statusCode).toBe(409);
  });

  it('solo el Admin; contenedores de otro espacio dan 400; matriz inválida, 400', async () => {
    const { ana, juan, ws } = await setup();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const ajeno = await containerOf(ana, other.id, 'WITH_END', 'Ajeno');
    const permissions = copyOf(PERMISSION_TEMPLATES.MEMBER);
    permissions.sections.WITH_END.view = 'SELECTED';

    const asJuan = await putPermissions(juan.cookies, ws.id, juan.user.id, {
      role: 'ADMIN',
      permissions,
      selectedProjectIds: [],
    });
    const foreign = await putPermissions(ana.cookies, ws.id, juan.user.id, {
      role: 'MEMBER',
      permissions,
      selectedProjectIds: [ajeno],
    });
    const invalid = await putPermissions(ana.cookies, ws.id, juan.user.id, {
      role: 'MEMBER',
      permissions: { sections: {}, tasks: {} },
      selectedProjectIds: [],
    });

    expect(asJuan.statusCode).toBe(403);
    expect(foreign.statusCode).toBe(400);
    expect(invalid.statusCode).toBe(400);
  });
});

describe('ver el trabajo de otra persona (HU-52)', () => {
  const permissionsUrl = (ws: string, userId: string) =>
    `/api/v1/workspaces/${ws}/members/${userId}/permissions`;
  const myTasksUrl = (ws: string, person?: string) =>
    `${base(ws)}/my-tasks${person ? `?person=${person}` : ''}`;

  /**
   * Además del espacio de `setup`: Luis (persona sin cuenta) con una tarea en ERP, y Ana permite a
   * Juan (plantilla Miembro: solo lo suyo) ver el trabajo de Luis
   */
  async function watching() {
    const data = await setup();
    const { ana, juan, ws, erp } = data;
    const luis = await db.person.create({
      data: { workspaceId: ws.id, name: 'Luis', ...auditCreate(null) },
    });
    const pedro = await db.person.create({
      data: { workspaceId: ws.id, name: 'Pedro', ...auditCreate(null) },
    });
    const luisTask = await createTask(db, ana.user.id, ws.id, erp.id, {
      ...emptyTask,
      title: 'De Luis',
      responsiblePersonId: luis.id,
    });
    const saved = await app.inject({
      method: 'PUT',
      url: permissionsUrl(ws.id, juan.user.id),
      cookies: ana.cookies,
      payload: {
        role: 'MEMBER',
        permissions: MEMBER,
        selectedProjectIds: [],
        watchedPersonIds: [luis.id],
      },
    });
    expect(saved.statusCode).toBe(204);
    return { ...data, luis, pedro, luisTask };
  }

  async function myTaskTitles(cookies: Cookies, ws: string, person?: string) {
    const response = await get(cookies, myTasksUrl(ws, person));
    expect(response.statusCode).toBe(200);
    return taskListSchema
      .parse(response.json())
      .map((t) => t.title)
      .sort();
  }

  it('se guarda en sus permisos y la API lo aplica: ve la tarea de Luis y su contenedor', async () => {
    const { ana, juan, ws, erp, luis } = await watching();

    const members = await get(ana.cookies, `${base(ws.id)}/members`);
    const juanMember = memberListSchema
      .parse(members.json())
      .find((m) => m.userId === juan.user.id);
    expect(juanMember?.matrix?.watchedPersonIds).toEqual([luis.id]);

    // ERP lo ve en solo lectura porque ahí trabaja Luis; de ERP solo ve la tarea de Luis
    expect(await projectNames(juan.cookies, ws.id)).toEqual(['ERP', 'Portal']);
    const tasks = await get(juan.cookies, tasksUrl(ws.id, erp.id));
    expect(taskListSchema.parse(tasks.json()).map((t) => t.title)).toEqual(['De Luis']);
  });

  it('solo la ve: no la modifica ni la da de baja', async () => {
    const { juan, ws, erp, luisTask } = await watching();
    const taskUrl = `${tasksUrl(ws.id, erp.id)}/${luisTask.id}`;

    const edit = await send(juan.cookies, 'PUT', taskUrl, { ...emptyTask, title: 'Cambiada' });
    const remove = await send(juan.cookies, 'DELETE', taskUrl);

    expect(edit.statusCode).toBe(403);
    expect(remove.statusCode).toBe(403);
  });

  it('Mi trabajo: lo suyo, lo de Luis o ambos; de alguien que no sigue, 404', async () => {
    const { juan, ws, luis, pedro } = await watching();

    expect(await myTaskTitles(juan.cookies, ws.id)).toEqual(['Asignada a Juan']);
    expect(await myTaskTitles(juan.cookies, ws.id, luis.id)).toEqual(['De Luis']);
    expect(await myTaskTitles(juan.cookies, ws.id, 'all')).toEqual(['Asignada a Juan', 'De Luis']);
    expect((await get(juan.cookies, myTasksUrl(ws.id, pedro.id))).statusCode).toBe(404);
  });

  it('el Admin ve el trabajo de cualquiera y, con "todos", también lo que no tiene Responsable', async () => {
    const { ana, ws, pedro } = await watching();

    expect(await myTaskTitles(ana.cookies, ws.id, 'all')).toEqual([
      'Asignada a Juan',
      'De Ana',
      'De Luis',
    ]);
    expect(await myTaskTitles(ana.cookies, ws.id, pedro.id)).toEqual([]);
  });

  it('personas de otro espacio dan 400', async () => {
    const { ana, juan, ws } = await watching();
    const other = await createWorkspace(db, ana.user.id, { name: 'Otro' });
    const ajena = await db.person.create({
      data: { workspaceId: other.id, name: 'Ajena', ...auditCreate(null) },
    });

    const response = await app.inject({
      method: 'PUT',
      url: permissionsUrl(ws.id, juan.user.id),
      cookies: ana.cookies,
      payload: {
        role: 'MEMBER',
        permissions: MEMBER,
        selectedProjectIds: [],
        watchedPersonIds: [ajena.id],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('solo trabajo (HU-53)', () => {
  it('el Lector no ve el contenedor Personal «Gimnasio» ni sus tareas; sí «Portal» (Trabajo)', async () => {
    const { ana, juan, ws } = await setup(PERMISSION_TEMPLATES.VIEWER);
    const gimnasio = await createProject(db, ana.user.id, ws.id, {
      ...emptyProject,
      name: 'Gimnasio',
      scope: 'PERSONAL',
    });
    await createTask(db, ana.user.id, ws.id, gimnasio.id, { ...emptyTask, title: 'Pesas' });

    expect(await projectNames(juan.cookies, ws.id)).toEqual(['ERP', 'Portal']);
    expect((await get(juan.cookies, projectUrl(ws.id, gimnasio.id))).statusCode).toBe(404);
    const tasks = workspaceTaskListSchema.parse(
      (await get(juan.cookies, `${base(ws.id)}/tasks`)).json(),
    );
    expect(tasks.map((t) => t.title)).not.toContain('Pesas');
  });

  it('sin «Solo trabajo» sí lo ve', async () => {
    const { ana, juan, ws } = await setup({ ...PERMISSION_TEMPLATES.VIEWER, workOnly: false });
    await createProject(db, ana.user.id, ws.id, {
      ...emptyProject,
      name: 'Gimnasio',
      scope: 'PERSONAL',
    });

    expect(await projectNames(juan.cookies, ws.id)).toEqual(['ERP', 'Gimnasio', 'Portal']);
  });
});
