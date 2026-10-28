import { canRemoveContainer, canRemoveTask, trashKindSchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import {
  requireMembership,
  requirePermission,
  type WorkspaceAccess,
} from '../workspaces/access.js';
import { trashedContainer, trashedTask } from '../workspaces/facts.js';
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

/**
 * Papelera del workspace (HU-15): cada quien ve y restaura lo que su permiso de "dar de baja y
 * restaurar" le permite (ADR-0006 §3); borrar definitivamente, solo el Admin
 */
export const trashRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  /** ¿Puede restaurar este elemento? Lo que no puede, para él no está en la papelera */
  async function canRestore(access: WorkspaceAccess, kind: 'project' | 'task', id: string) {
    if (kind === 'project') {
      const facts = await trashedContainer(app.db, access.workspaceId, id);
      return facts !== null && canRemoveContainer(access, facts);
    }
    const facts = await trashedTask(app.db, access.workspaceId, id);
    return facts !== null && canRemoveTask(access, facts);
  }

  app.get(BASE, { preHandler: requireMembership }, async (request) => {
    const access = request.membership!;
    const filter =
      access.role === 'ADMIN'
        ? undefined
        : {
            project: (facts: Parameters<typeof canRemoveContainer>[1]) =>
              canRemoveContainer(access, facts),
            task: (facts: Parameters<typeof canRemoveTask>[1]) => canRemoveTask(access, facts),
          };
    return listTrash(app.db, access.workspaceId, filter);
  });

  app.post(
    `${BASE}/:kind/:id/restore`,
    { preHandler: requireMembership },
    async (request, reply) => {
      const item = parseItem(request);
      if (!item || !(await canRestore(request.membership!, item.kind, item.id))) {
        return notInTrash(reply);
      }
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
    },
  );

  app.delete(
    `${BASE}/:kind/:id`,
    { preHandler: requirePermission('trash.manage') },
    async (request, reply) => {
      const item = parseItem(request);
      const purged =
        item && (await purgeFromTrash(app.db, request.membership!.workspaceId, item.kind, item.id));
      return purged ? reply.code(204).send() : notInTrash(reply);
    },
  );

  done();
};
