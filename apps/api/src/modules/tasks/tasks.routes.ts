import {
  myTasksQuerySchema,
  taskInputSchema,
  taskStatusUpdateSchema,
  type TaskInput,
} from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { getProject } from '../projects/projects.service.js';
import { requirePermission } from '../workspaces/access.js';
import { assignablePeople } from '../people/people.service.js';
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

/** Tareas de un proyecto (HU-08). Cada ruta exige sesión, membresía y el permiso del rol */
export const tasksRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  /** ID del proyecto de la URL, si existe en el workspace y no está en la papelera */
  async function findProjectId(request: FastifyRequest) {
    const params = projectParamsSchema.safeParse(request.params);
    if (!params.success) return null;
    const project = await getProject(
      app.db,
      request.membership!.workspaceId,
      params.data.projectId,
    );
    return project?.id ?? null;
  }

  // Mi trabajo (HU-28b): las tareas asignadas a quien pregunta, de todos los proyectos del espacio
  app.get(
    '/workspaces/:workspaceId/my-tasks',
    { preHandler: requirePermission('project.read') },
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
  app.get(
    '/workspaces/:workspaceId/tasks',
    { preHandler: requirePermission('project.read') },
    async (request) => listWorkspaceTasks(app.db, request.membership!.workspaceId),
  );

  app.get(BASE, { preHandler: requirePermission('project.read') }, async (request, reply) => {
    const projectId = await findProjectId(request);
    if (!projectId) return notFound(reply, 'Proyecto no encontrado');
    return listTasks(app.db, request.membership!.workspaceId, projectId);
  });

  app.post(BASE, { preHandler: requirePermission('task.create') }, async (request, reply) => {
    const projectId = await findProjectId(request);
    if (!projectId) return notFound(reply, 'Proyecto no encontrado');

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

  app.put(
    `${BASE}/:taskId`,
    { preHandler: requirePermission('task.update') },
    async (request, reply) => {
      const params = taskParamsSchema.safeParse(request.params);
      if (!params.success) return notFound(reply, 'Tarea no encontrada');

      const parsed = taskInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      const where = { workspaceId: request.membership!.workspaceId, ...params.data };
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
    },
  );

  // Cambiar solo el estado de la tarea, sin enviar el resto de los datos
  app.patch(
    `${BASE}/:taskId/status`,
    { preHandler: requirePermission('task.update') },
    async (request, reply) => {
      const params = taskParamsSchema.safeParse(request.params);
      if (!params.success) return notFound(reply, 'Tarea no encontrada');

      const parsed = taskStatusUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      const task = await updateTaskStatus(
        app.db,
        request.auth!.userId,
        { workspaceId: request.membership!.workspaceId, ...params.data },
        parsed.data.status,
        parsed.data.statusReason,
      );
      return task ?? notFound(reply, 'Tarea no encontrada');
    },
  );

  // Dar de baja: va a la papelera (HU-15)
  app.delete(
    `${BASE}/:taskId`,
    { preHandler: requirePermission('task.delete') },
    async (request, reply) => {
      const params = taskParamsSchema.safeParse(request.params);
      const deleted =
        params.success &&
        (await softDeleteTask(app.db, request.auth!.userId, {
          workspaceId: request.membership!.workspaceId,
          ...params.data,
        }));
      return deleted ? reply.code(204).send() : notFound(reply, 'Tarea no encontrada');
    },
  );

  done();
};
