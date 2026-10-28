import { canCreateTaskIn, canUpdateTask, moveProjectSchema, moveTaskSchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import {
  forbidden,
  permissionIn,
  requireMembership,
  requirePermission,
} from '../workspaces/access.js';
import { visibleContainer, visibleTask } from '../workspaces/facts.js';
import {
  InvalidTargetTypeError,
  moveProject,
  moveTask,
  TargetDisallowsTaskTypesError,
  TargetFolioTakenError,
  TargetProjectNotFoundError,
} from './moves.service.js';

const projectParamsSchema = z.object({ projectId: z.uuid() });
const taskParamsSchema = z.object({ projectId: z.uuid(), taskId: z.uuid() });

function moveError(reply: FastifyReply, error: unknown) {
  if (error instanceof InvalidTargetTypeError) {
    return reply.code(400).send({ message: 'Elige un tipo activo del espacio de destino' });
  }
  if (error instanceof TargetProjectNotFoundError) {
    return reply.code(404).send({ message: 'Proyecto de destino no encontrado' });
  }
  if (error instanceof TargetFolioTakenError) {
    return reply.code(409).send({
      message: `El espacio de destino ya tiene el folio ${error.folio}: cámbialo primero`,
    });
  }
  if (error instanceof TargetDisallowsTaskTypesError) {
    return reply.code(409).send({
      message: `El destino no admite tareas de tipo ${error.taskTypes.join(', ')}: elige otro tipo o cámbialas primero`,
    });
  }
  throw error;
}

/**
 * En el destino también se exige ser Admin (`project.move`), salvo al mover una tarea dentro del
 * mismo espacio. null si se puede seguir; si no, ya respondió 404 o 403.
 */
async function checkTarget(
  request: FastifyRequest,
  reply: FastifyReply,
  targetWorkspaceId: string,
) {
  const allowed = await permissionIn(
    request.server.db,
    targetWorkspaceId,
    request.auth!.userId,
    'project.move',
  );
  if (allowed === null)
    return reply.code(404).send({ message: 'Espacio de destino no encontrado' });
  if (!allowed)
    return reply.code(403).send({ message: 'Debes ser Admin en el espacio de destino' });
  return null;
}

/** Mover entre espacios (HU-32): contenedores con sus tareas, y tareas sueltas */
export const movesRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.post(
    '/workspaces/:workspaceId/projects/:projectId/move',
    { preHandler: requirePermission('project.move') },
    async (request, reply) => {
      const params = projectParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: 'Proyecto no encontrado' });
      const parsed = moveProjectSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      if (parsed.data.targetWorkspaceId === request.membership!.workspaceId) {
        return reply.code(400).send({ message: 'Elige un espacio distinto del actual' });
      }
      const denied = await checkTarget(request, reply, parsed.data.targetWorkspaceId);
      if (denied) return denied;
      try {
        const moved = await moveProject(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          params.data.projectId,
          parsed.data,
        );
        if (!moved) return reply.code(404).send({ message: 'Proyecto no encontrado' });
      } catch (error) {
        return moveError(reply, error);
      }
      return reply.code(204).send();
    },
  );

  app.post(
    '/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/move',
    { preHandler: requireMembership },
    async (request, reply) => {
      const access = request.membership!;
      const params = taskParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: 'Tarea no encontrada' });
      const parsed = moveTaskSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      // Debe poder ver y modificar la tarea (ADR-0006)
      const task = await visibleTask(app.db, access, params.data.projectId, params.data.taskId);
      if (!task) return reply.code(404).send({ message: 'Tarea no encontrada' });
      if (!canUpdateTask(access, task)) return forbidden(reply);
      const sourceWorkspaceId = access.workspaceId;
      if (parsed.data.targetWorkspaceId === sourceWorkspaceId) {
        // En el mismo espacio: también debe poder agregar tareas al destino
        const target = await visibleContainer(app.db, access, parsed.data.targetProjectId);
        if (!target) return reply.code(404).send({ message: 'Proyecto de destino no encontrado' });
        if (!canCreateTaskIn(access, target, true)) return forbidden(reply);
      } else {
        // A otro espacio: Admin en los dos
        const inSource = await permissionIn(
          app.db,
          sourceWorkspaceId,
          request.auth!.userId,
          'project.move',
        );
        if (!inSource) return reply.code(403).send({ message: 'Debes ser Admin en este espacio' });
        const denied = await checkTarget(request, reply, parsed.data.targetWorkspaceId);
        if (denied) return denied;
      }
      try {
        const moved = await moveTask(
          app.db,
          request.auth!.userId,
          { workspaceId: sourceWorkspaceId, ...params.data },
          parsed.data,
        );
        if (!moved) return reply.code(404).send({ message: 'Tarea no encontrada' });
      } catch (error) {
        return moveError(reply, error);
      }
      return reply.code(204).send();
    },
  );

  done();
};
