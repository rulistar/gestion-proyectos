import { createTaskOriginSchema, updateTaskOriginSchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requireMembership, requirePermission } from '../workspaces/access.js';
import {
  createTaskOrigin,
  DuplicateOriginNameError,
  listTaskOrigins,
  updateTaskOrigin,
} from './task-origins.service.js';

const originParamsSchema = z.object({ originId: z.uuid() });

const BASE = '/workspaces/:workspaceId/task-origins';

function originError(reply: FastifyReply, error: unknown) {
  if (error instanceof DuplicateOriginNameError) {
    return reply.code(409).send({ message: 'Ya existe un origen activo con ese nombre' });
  }
  throw error;
}

/** Catálogo de orígenes de tarea (HU-47). Lo ve todo miembro (para elegir); lo cambia el Admin */
export const taskOriginsRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requireMembership }, async (request) =>
    listTaskOrigins(app.db, request.membership!.workspaceId),
  );

  app.post(BASE, { preHandler: requirePermission('catalog.manage') }, async (request, reply) => {
    const parsed = createTaskOriginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      await createTaskOrigin(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        parsed.data,
      );
    } catch (error) {
      return originError(reply, error);
    }
    return reply.code(201).send(await listTaskOrigins(app.db, request.membership!.workspaceId));
  });

  app.patch(
    `${BASE}/:originId`,
    { preHandler: requirePermission('catalog.manage') },
    async (request, reply) => {
      const params = originParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: 'Origen no encontrado' });
      const parsed = updateTaskOriginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      try {
        const found = await updateTaskOrigin(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          params.data.originId,
          parsed.data,
        );
        if (!found) return reply.code(404).send({ message: 'Origen no encontrado' });
      } catch (error) {
        return originError(reply, error);
      }
      return listTaskOrigins(app.db, request.membership!.workspaceId);
    },
  );

  done();
};
