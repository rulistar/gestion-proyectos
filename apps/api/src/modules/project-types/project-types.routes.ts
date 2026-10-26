import { createProjectTypeSchema, updateProjectTypeSchema } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import {
  createProjectType,
  DuplicateTypeNameError,
  LastActiveTypeError,
  listProjectTypes,
  updateProjectType,
} from './project-types.service.js';

const typeParamsSchema = z.object({ typeId: z.uuid() });

const BASE = '/workspaces/:workspaceId/project-types';

function catalogError(reply: FastifyReply, error: unknown) {
  if (error instanceof DuplicateTypeNameError) {
    return reply.code(409).send({ message: 'Ya existe un tipo activo con ese nombre' });
  }
  if (error instanceof LastActiveTypeError) {
    return reply.code(409).send({ message: 'Debe quedar al menos un tipo activo' });
  }
  throw error;
}

/** Catálogo de tipos de contenedor (HU-21). Lo ve quien ve proyectos; lo cambia el Admin */
export const projectTypesRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requirePermission('project.read') }, async (request) =>
    listProjectTypes(app.db, request.membership!.workspaceId),
  );

  app.post(BASE, { preHandler: requirePermission('catalog.manage') }, async (request, reply) => {
    const parsed = createProjectTypeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    try {
      await createProjectType(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        parsed.data,
      );
    } catch (error) {
      return catalogError(reply, error);
    }
    return reply.code(201).send(await listProjectTypes(app.db, request.membership!.workspaceId));
  });

  app.patch(
    `${BASE}/:typeId`,
    { preHandler: requirePermission('catalog.manage') },
    async (request, reply) => {
      const params = typeParamsSchema.safeParse(request.params);
      if (!params.success) return reply.code(404).send({ message: 'Tipo no encontrado' });
      const parsed = updateProjectTypeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      try {
        const found = await updateProjectType(
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
      return listProjectTypes(app.db, request.membership!.workspaceId);
    },
  );

  done();
};
