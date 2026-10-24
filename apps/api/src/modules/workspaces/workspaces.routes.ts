import { createWorkspaceRequestSchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requireMembership } from './access.js';
import { createWorkspace, listWorkspacesForUser } from './workspaces.service.js';

export const workspacesRoutes: FastifyPluginCallback = (app, _options, done) => {
  // Todas las rutas de este módulo exigen sesión
  app.addHook('preHandler', requireAuth);

  app.get('/workspaces', async (request) => {
    return listWorkspacesForUser(app.db, request.auth!.userId);
  });

  // Un workspace del que soy miembro, con mi rol en él (404 si no lo soy)
  app.get('/workspaces/:workspaceId', { preHandler: requireMembership }, async (request) => {
    const { workspaceId, role } = request.membership!;
    const workspace = await app.db.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    return { ...workspace, role };
  });

  app.post('/workspaces', async (request, reply) => {
    const parsed = createWorkspaceRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    const workspace = await createWorkspace(app.db, request.auth!.userId, parsed.data);
    return reply.code(201).send(workspace);
  });

  done();
};
