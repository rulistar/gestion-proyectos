import { trashKindSchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import { listTrash, purgeFromTrash, restoreFromTrash } from './trash.service.js';

const itemParamsSchema = z.object({ kind: trashKindSchema, id: z.uuid() });

const BASE = '/workspaces/:workspaceId/trash';

function notInTrash(reply: FastifyReply) {
  return reply.code(404).send({ message: 'No está en la papelera' });
}

function parseItem(request: FastifyRequest) {
  const params = itemParamsSchema.safeParse(request.params);
  return params.success ? params.data : null;
}

/** Papelera del workspace (HU-15): ver, restaurar y borrar definitivamente. Solo Admin */
export const trashRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);
  const guard = { preHandler: requirePermission('trash.manage') };

  app.get(BASE, guard, async (request) => listTrash(app.db, request.membership!.workspaceId));

  app.post(`${BASE}/:kind/:id/restore`, guard, async (request, reply) => {
    const item = parseItem(request);
    const restored =
      item &&
      (await restoreFromTrash(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        item.kind,
        item.id,
      ));
    return restored ? reply.code(204).send() : notInTrash(reply);
  });

  app.delete(`${BASE}/:kind/:id`, guard, async (request, reply) => {
    const item = parseItem(request);
    const purged =
      item && (await purgeFromTrash(app.db, request.membership!.workspaceId, item.kind, item.id));
    return purged ? reply.code(204).send() : notInTrash(reply);
  });

  done();
};
