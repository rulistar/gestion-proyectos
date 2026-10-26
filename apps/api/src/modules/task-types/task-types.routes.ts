import { createTaskTypeSchema, updateTaskTypeSchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { catalogError } from '../project-types/project-types.routes.js';
import { requirePermission } from '../workspaces/access.js';
import { createTaskType, listTaskTypes, updateTaskType } from './task-types.service.js';

const typeParamsSchema = z.object({ typeId: z.uuid() });

const BASE = '/workspaces/:workspaceId/task-types';

/** Catálogo de tipos de tarea (HU-22). Lo ve quien ve proyectos; lo cambia el Admin */
export const taskTypesRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requirePermission('project.read') }, async (request) =>
    listTaskTypes(app.db, request.membership!.workspaceId),
  );

  app.post(BASE, { preHandler: requirePermission('catalog.manage') }, async (request, reply) => {
    const parsed = createTaskTypeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      await createTaskType(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        parsed.data,
      );
    } catch (error) {
      return catalogError(reply, error);
    }
    return reply.code(201).send(await listTaskTypes(app.db, request.membership!.workspaceId));
  });

  app.patch(
    `${BASE}/:typeId`,
    { preHandler: requirePermission('catalog.manage') },
    async (request, reply) => {
      const params = typeParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: 'Tipo no encontrado' });
      const parsed = updateTaskTypeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      try {
        const found = await updateTaskType(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          params.data.typeId,
          parsed.data,
        );
        if (!found) return reply.code(404).send({ message: 'Tipo no encontrado' });
      } catch (error) {
        return catalogError(reply, error);
      }
      return listTaskTypes(app.db, request.membership!.workspaceId);
    },
  );

  done();
};
