import {
  canCreateContainer,
  canRemoveContainer,
  canUpdateContainer,
  projectInputSchema,
  projectMetricsQuerySchema,
  projectStatusUpdateSchema,
  type ProjectBehavior,
} from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { InvalidDetailsError } from '../detail-fields/detail-fields.service.js';
import { requireAuth } from '../auth/session.js';
import { resolveProjectType } from '../project-types/project-types.service.js';
import { forbidden, requireMembership } from '../workspaces/access.js';
import { visibleContainer } from '../workspaces/facts.js';
import { projectVisibleWhere } from '../workspaces/visibility.js';
import {
  createProject,
  defaultMetrics,
  DisallowedTaskTypesError,
  getProject,
  InvalidProjectPeopleError,
  InvalidProjectTypeError,
  InvalidTaskTypeSelectionError,
  listProjects,
  softDeleteProject,
  updateProjectStatus,
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
  if (error instanceof InvalidDetailsError) {
    return reply.code(400).send({ message: `Detalle: ${error.message}` });
  }
  if (error instanceof InvalidProjectPeopleError) {
    return reply
      .code(400)
      .send({ message: 'Las personas del proyecto deben ser del catálogo de este espacio' });
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

/**
 * Proyectos de un workspace (HU-05). Cada ruta exige sesión y membresía; qué ve y qué puede hacer
 * lo decide su matriz de permisos (ADR-0006)
 */
export const projectsRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  /** Sección del tipo pedido (o del tipo por omisión); null si el tipo no es válido */
  async function behaviorOfType(workspaceId: string, requested: string | null) {
    const typeId = await resolveProjectType(app.db, workspaceId, requested);
    if (!typeId) return null;
    const type = await app.db.projectType.findUnique({
      where: { id: typeId },
      select: { behavior: true },
    });
    return type?.behavior ?? null;
  }

  app.get(
    '/workspaces/:workspaceId/projects',
    { preHandler: requireMembership },
    async (request) => {
      const access = request.membership!;
      return listProjects(
        app.db,
        access.workspaceId,
        metricsOf(request),
        projectVisibleWhere(access),
      );
    },
  );

  app.post(
    '/workspaces/:workspaceId/projects',
    { preHandler: requireMembership },
    async (request, reply) => {
      const access = request.membership!;
      const parsed = projectInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      // Crear en esa sección (proyectos, mantenimientos o actividades) según su matriz
      const behavior: ProjectBehavior | null = await behaviorOfType(
        access.workspaceId,
        parsed.data.typeId,
      );
      if (behavior && !canCreateContainer(access, behavior)) return forbidden(reply);
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
    { preHandler: requireMembership },
    async (request, reply) => {
      const access = request.membership!;
      const params = projectParamsSchema.safeParse(request.params);
      const project = params.success
        ? await getProject(
            app.db,
            access.workspaceId,
            params.data.projectId,
            metricsOf(request),
            projectVisibleWhere(access),
          )
        : null;
      return project ?? projectNotFound(reply);
    },
  );

  app.put(
    '/workspaces/:workspaceId/projects/:projectId',
    { preHandler: requireMembership },
    async (request, reply) => {
      const access = request.membership!;
      const params = projectParamsSchema.safeParse(request.params);
      if (!params.success) return projectNotFound(reply);
      const container = await visibleContainer(app.db, access, params.data.projectId);
      if (!container) return projectNotFound(reply);
      if (!canUpdateContainer(access, container)) return forbidden(reply);

      const parsed = projectInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      // Cambiarlo de sección (p. ej. de proyecto a mantenimiento) es como crearlo en la otra
      const behavior =
        parsed.data.typeId === null
          ? container.behavior
          : await behaviorOfType(access.workspaceId, parsed.data.typeId);
      if (behavior && behavior !== container.behavior && !canCreateContainer(access, behavior)) {
        return forbidden(reply);
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

  // Pasarlo de columna en el tablero (HU-10): mismo permiso que editarlo
  app.patch(
    '/workspaces/:workspaceId/projects/:projectId/status',
    { preHandler: requireMembership },
    async (request, reply) => {
      const access = request.membership!;
      const params = projectParamsSchema.safeParse(request.params);
      if (!params.success) return projectNotFound(reply);
      const container = await visibleContainer(app.db, access, params.data.projectId);
      if (!container) return projectNotFound(reply);
      if (!canUpdateContainer(access, container)) return forbidden(reply);
      const parsed = projectStatusUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      const project = await updateProjectStatus(
        app.db,
        request.auth!.userId,
        access.workspaceId,
        params.data.projectId,
        parsed.data.status,
        metricsOf(request),
      );
      return project ?? projectNotFound(reply);
    },
  );

  // Dar de baja: va a la papelera (HU-15); el borrado definitivo solo se hace desde ahí
  app.delete(
    '/workspaces/:workspaceId/projects/:projectId',
    { preHandler: requireMembership },
    async (request, reply) => {
      const access = request.membership!;
      const params = projectParamsSchema.safeParse(request.params);
      const container = params.success
        ? await visibleContainer(app.db, access, params.data.projectId)
        : null;
      if (!container) return projectNotFound(reply);
      if (!canRemoveContainer(access, container)) return forbidden(reply);
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
