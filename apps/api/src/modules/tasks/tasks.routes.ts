import { taskInputSchema, taskStatusUpdateSchema, type TaskInput } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { getProject } from '../projects/projects.service.js';
import { requirePermission } from '../workspaces/access.js';
import { isActiveMember } from '../workspaces/workspaces.service.js';
import { createTask, listTasks, updateTask, updateTaskStatus } from './tasks.service.js';

const projectParamsSchema = z.object({ projectId: z.uuid() });
const taskParamsSchema = z.object({ projectId: z.uuid(), taskId: z.uuid() });

const BASE = '/workspaces/:workspaceId/projects/:projectId/tasks';

function notFound(reply: FastifyReply, message: 'Proyecto no encontrado' | 'Tarea no encontrada') {
  return reply.code(404).send({ message });
}

/** El responsable debe ser un miembro activo del mismo workspace (o nadie) */
async function invalidAssignee(request: FastifyRequest, input: TaskInput) {
  return (
    input.assigneeId !== null &&
    !(await isActiveMember(request.server.db, request.membership!.workspaceId, input.assigneeId))
  );
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
    if (await invalidAssignee(request, parsed.data)) {
      return reply.code(400).send({ message: 'El responsable debe ser miembro del workspace' });
    }
    const task = await createTask(
      app.db,
      request.auth!.userId,
      request.membership!.workspaceId,
      projectId,
      parsed.data,
    );
    return reply.code(201).send(task);
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
      if (await invalidAssignee(request, parsed.data)) {
        return reply.code(400).send({ message: 'El responsable debe ser miembro del workspace' });
      }
      const task = await updateTask(
        app.db,
        request.auth!.userId,
        { workspaceId: request.membership!.workspaceId, ...params.data },
        parsed.data,
      );
      return task ?? notFound(reply, 'Tarea no encontrada');
    },
  );

  // Mover la tarea entre Pendiente, En curso y Hecha sin enviar el resto de los datos
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

  done();
};
