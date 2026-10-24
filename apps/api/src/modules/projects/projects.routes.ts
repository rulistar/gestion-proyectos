import { projectInputSchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import { createProject, getProject, listProjects, updateProject } from './projects.service.js';

const projectParamsSchema = z.object({ projectId: z.uuid() });

function projectNotFound(reply: FastifyReply) {
  return reply.code(404).send({ message: 'Proyecto no encontrado' });
}

/** Proyectos de un workspace (HU-05). Cada ruta exige sesión, membresía y el permiso del rol */
export const projectsRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/workspaces/:workspaceId/projects',
    { preHandler: requirePermission('project.read') },
    async (request) => listProjects(app.db, request.membership!.workspaceId),
  );

  app.post(
    '/workspaces/:workspaceId/projects',
    { preHandler: requirePermission('project.create') },
    async (request, reply) => {
      const parsed = projectInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      const project = await createProject(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        parsed.data,
      );
      return reply.code(201).send(project);
    },
  );

  app.get(
    '/workspaces/:workspaceId/projects/:projectId',
    { preHandler: requirePermission('project.read') },
    async (request, reply) => {
      const params = projectParamsSchema.safeParse(request.params);
      const project = params.success
        ? await getProject(app.db, request.membership!.workspaceId, params.data.projectId)
        : null;
      return project ?? projectNotFound(reply);
    },
  );

  app.put(
    '/workspaces/:workspaceId/projects/:projectId',
    { preHandler: requirePermission('project.update') },
    async (request, reply) => {
      const params = projectParamsSchema.safeParse(request.params);
      if (!params.success) return projectNotFound(reply);

      const parsed = projectInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      const project = await updateProject(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        params.data.projectId,
        parsed.data,
      );
      return project ?? projectNotFound(reply);
    },
  );

  done();
};
