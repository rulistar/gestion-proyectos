import { projectInputSchema, projectMetricsQuerySchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import {
  createProject,
  defaultMetrics,
  DisallowedTaskTypesError,
  getProject,
  InvalidProjectTypeError,
  InvalidTaskTypeSelectionError,
  listProjects,
  softDeleteProject,
  updateProject,
} from './projects.service.js';
import { DuplicateFolioError } from './folios.js';

const projectParamsSchema = z.object({ projectId: z.uuid() });

function projectNotFound(reply: FastifyReply) {
  return reply.code(404).send({ message: 'Proyecto no encontrado' });
}

/** La fecha local que manda la web (inválida u omitida → día y mes en UTC) */
function metricsOf(request: FastifyRequest) {
  const query = projectMetricsQuerySchema.safeParse(request.query);
  const fallback = defaultMetrics();
  return {
    today: (query.success && query.data.today) || fallback.today,
    monthStart: (query.success && query.data.monthStart) || fallback.monthStart,
  };
}

function invalidType(reply: FastifyReply, error: unknown) {
  if (error instanceof InvalidProjectTypeError) {
    return reply.code(400).send({ message: 'El tipo no existe en este espacio o está archivado' });
  }
  if (error instanceof InvalidTaskTypeSelectionError) {
    return reply.code(400).send({
      message: 'Elige solo tipos de tarea activos que admita el tipo de este contenedor',
    });
  }
  if (error instanceof DuplicateFolioError) {
    return reply.code(409).send({ message: `El folio ${error.folio} ya existe en este espacio` });
  }
  if (error instanceof DisallowedTaskTypesError) {
    return reply.code(409).send({
      message: `El tipo nuevo no admite tareas de tipo ${error.taskTypes.join(', ')}: cámbialas primero`,
    });
  }
  throw error;
}

/** Proyectos de un workspace (HU-05). Cada ruta exige sesión, membresía y el permiso del rol */
export const projectsRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/workspaces/:workspaceId/projects',
    { preHandler: requirePermission('project.read') },
    async (request) => listProjects(app.db, request.membership!.workspaceId, metricsOf(request)),
  );

  app.post(
    '/workspaces/:workspaceId/projects',
    { preHandler: requirePermission('project.create') },
    async (request, reply) => {
      const parsed = projectInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      try {
        // La fecha local del usuario decide el mes del folio automático (HU-38)
        const project = await createProject(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          parsed.data,
          metricsOf(request),
        );
        return await reply.code(201).send(project);
      } catch (error) {
        return invalidType(reply, error);
      }
    },
  );

  app.get(
    '/workspaces/:workspaceId/projects/:projectId',
    { preHandler: requirePermission('project.read') },
    async (request, reply) => {
      const params = projectParamsSchema.safeParse(request.params);
      const project = params.success
        ? await getProject(
            app.db,
            request.membership!.workspaceId,
            params.data.projectId,
            metricsOf(request),
          )
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
      try {
        const project = await updateProject(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          params.data.projectId,
          parsed.data,
          metricsOf(request),
        );
        return project ?? projectNotFound(reply);
      } catch (error) {
        return invalidType(reply, error);
      }
    },
  );

  // Dar de baja: va a la papelera (HU-15); el borrado definitivo solo se hace desde ahí
  app.delete(
    '/workspaces/:workspaceId/projects/:projectId',
    { preHandler: requirePermission('project.delete') },
    async (request, reply) => {
      const params = projectParamsSchema.safeParse(request.params);
      const deleted =
        params.success &&
        (await softDeleteProject(
          app.db,
          request.auth!.userId,
          request.membership!.workspaceId,
          params.data.projectId,
        ));
      return deleted ? reply.code(204).send() : projectNotFound(reply);
    },
  );

  done();
};
