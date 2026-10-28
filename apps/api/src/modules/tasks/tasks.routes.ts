import {
  canCreateTaskIn,
  canRemoveTask,
  canUpdateTask,
  myTasksQuerySchema,
  taskInputSchema,
  taskStatusUpdateSchema,
  type TaskInput,
} from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { forbidden, requireMembership } from '../workspaces/access.js';
import { visibleContainer, visibleTask } from '../workspaces/facts.js';
import { taskVisibleWhere } from '../workspaces/visibility.js';
import { assignablePeople } from '../people/people.service.js';
import { InvalidTaskOriginError } from '../task-origins/task-origins.service.js';
import {
  createTask,
  currentResponsible,
  InvalidTaskTypeError,
  listMyTasks,
  listTasks,
  listWorkspaceTasks,
  softDeleteTask,
  updateTask,
  updateTaskStatus,
} from './tasks.service.js';

const projectParamsSchema = z.object({ projectId: z.uuid() });
const taskParamsSchema = z.object({ projectId: z.uuid(), taskId: z.uuid() });

const WEEK_MS = 7 * 86_400_000;

const BASE = '/workspaces/:workspaceId/projects/:projectId/tasks';

function notFound(reply: FastifyReply, message: 'Proyecto no encontrado' | 'Tarea no encontrada') {
  return reply.code(404).send({ message });
}

function invalidType(reply: FastifyReply, error: unknown) {
  if (error instanceof InvalidTaskTypeError) {
    return reply
      .code(400)
      .send({ message: 'Ese tipo de tarea no existe, está archivado o no se admite aquí' });
  }
  if (error instanceof InvalidTaskOriginError) {
    return reply.code(400).send({ message: 'Ese origen no existe o está archivado' });
  }
  throw error;
}

const INVALID_PEOPLE = 'El responsable debe ser una persona del catálogo de este espacio';

/**
 * Responsable (HU-35): una persona activa del catálogo del espacio, o nadie. Al editar se puede
 * conservar la que ya tenía aunque esté archivada.
 */
async function invalidPeople(
  request: FastifyRequest,
  input: TaskInput,
  kept: string | null = null,
) {
  return !(await assignablePeople(
    request.server.db,
    request.membership!.workspaceId,
    [input.responsiblePersonId],
    [kept],
  ));
}

/**
 * Tareas de un proyecto (HU-08). Cada ruta exige sesión y membresía; qué tareas ve y cuáles puede
 * modificar o dar de baja lo decide su matriz de permisos (ADR-0006)
 */
export const tasksRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  /** El contenedor de la URL, si existe, no está en la papelera y la persona lo ve */
  async function findContainer(request: FastifyRequest) {
    const params = projectParamsSchema.safeParse(request.params);
    if (!params.success) return null;
    return visibleContainer(app.db, request.membership!, params.data.projectId);
  }

  /** La tarea de la URL, si la persona la ve (si no, 404 sin revelar que existe) */
  async function findTask(request: FastifyRequest) {
    const params = taskParamsSchema.safeParse(request.params);
    if (!params.success) return null;
    const facts = await visibleTask(
      app.db,
      request.membership!,
      params.data.projectId,
      params.data.taskId,
    );
    return facts && { facts, params: params.data };
  }

  // Mi trabajo (HU-28b): las tareas asignadas a quien pregunta, de todos los proyectos del espacio
  app.get(
    '/workspaces/:workspaceId/my-tasks',
    { preHandler: requireMembership },
    async (request, reply) => {
      const query = myTasksQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.code(400).send({ message: z.prettifyError(query.error) });
      }
      const doneSince = query.data.doneSince
        ? new Date(query.data.doneSince)
        : new Date(Date.now() - WEEK_MS);
      return listMyTasks(app.db, request.membership!.workspaceId, request.auth!.userId, doneSince);
    },
  );

  // Vista "Tareas" (HU-39): todas las del espacio, con su contenedor
  app.get('/workspaces/:workspaceId/tasks', { preHandler: requireMembership }, async (request) => {
    const access = request.membership!;
    return listWorkspaceTasks(app.db, access.workspaceId, taskVisibleWhere(access));
  });

  app.get(BASE, { preHandler: requireMembership }, async (request, reply) => {
    const access = request.membership!;
    const container = await findContainer(request);
    if (!container) return notFound(reply, 'Proyecto no encontrado');
    return listTasks(app.db, access.workspaceId, container.id, taskVisibleWhere(access));
  });

  app.post(BASE, { preHandler: requireMembership }, async (request, reply) => {
    const container = await findContainer(request);
    if (!container) return notFound(reply, 'Proyecto no encontrado');
    // Si lo ve (aunque sea en solo lectura por tener una tarea), puede agregar si su matriz lo dice
    if (!canCreateTaskIn(request.membership!, container, true)) return forbidden(reply);
    const projectId = container.id;

    const parsed = taskInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    if (await invalidPeople(request, parsed.data)) {
      return reply.code(400).send({ message: INVALID_PEOPLE });
    }
    try {
      const task = await createTask(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        projectId,
        parsed.data,
      );
      return await reply.code(201).send(task);
    } catch (error) {
      return invalidType(reply, error);
    }
  });

  app.put(`${BASE}/:taskId`, { preHandler: requireMembership }, async (request, reply) => {
    const found = await findTask(request);
    if (!found) return notFound(reply, 'Tarea no encontrada');
    if (!canUpdateTask(request.membership!, found.facts)) return forbidden(reply);
    const { params } = found;

    const parsed = taskInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    const where = { workspaceId: request.membership!.workspaceId, ...params };
    const current = await currentResponsible(app.db, where);
    if (current === undefined) return notFound(reply, 'Tarea no encontrada');
    if (await invalidPeople(request, parsed.data, current)) {
      return reply.code(400).send({ message: INVALID_PEOPLE });
    }
    try {
      const task = await updateTask(app.db, request.auth!.userId, where, parsed.data);
      return task ?? notFound(reply, 'Tarea no encontrada');
    } catch (error) {
      return invalidType(reply, error);
    }
  });

  // Cambiar solo el estado de la tarea, sin enviar el resto de los datos
  app.patch(`${BASE}/:taskId/status`, { preHandler: requireMembership }, async (request, reply) => {
    const found = await findTask(request);
    if (!found) return notFound(reply, 'Tarea no encontrada');
    if (!canUpdateTask(request.membership!, found.facts)) return forbidden(reply);

    const parsed = taskStatusUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    const task = await updateTaskStatus(
      app.db,
      request.auth!.userId,
      { workspaceId: request.membership!.workspaceId, ...found.params },
      parsed.data.status,
      parsed.data.statusReason,
    );
    return task ?? notFound(reply, 'Tarea no encontrada');
  });

  // Dar de baja: va a la papelera (HU-15)
  app.delete(`${BASE}/:taskId`, { preHandler: requireMembership }, async (request, reply) => {
    const found = await findTask(request);
    if (!found) return notFound(reply, 'Tarea no encontrada');
    if (!canRemoveTask(request.membership!, found.facts)) return forbidden(reply);
    const deleted = await softDeleteTask(app.db, request.auth!.userId, {
      workspaceId: request.membership!.workspaceId,
      ...found.params,
    });
    return deleted ? reply.code(204).send() : notFound(reply, 'Tarea no encontrada');
  });

  done();
};
