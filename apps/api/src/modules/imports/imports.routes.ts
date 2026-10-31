import { importRequestSchema, projectMetricsQuerySchema, readImportFile } from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { defaultMetrics } from '../projects/projects.service.js';
import { requirePermission } from '../workspaces/access.js';
import { applyImport, ImportTooLargeError, previewImport } from './imports.service.js';

/** El archivo va como texto en el cuerpo: se permite más que el límite normal (1 MB) */
const routeOptions = {
  preHandler: requirePermission('catalog.manage'),
  bodyLimit: 6 * 1024 * 1024,
} as const;

function readBody(request: FastifyRequest, reply: FastifyReply) {
  const parsed = importRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    void reply.code(400).send({ message: z.prettifyError(parsed.error) });
    return null;
  }
  return readImportFile(parsed.data.content);
}

function importError(reply: FastifyReply, error: unknown) {
  if (error instanceof ImportTooLargeError) return reply.code(400).send({ message: error.message });
  throw error;
}

/**
 * Cargar información (HU-14): solo el Admin del espacio (decisión del PO). Primero la vista previa
 * (no escribe nada) y, al confirmar, la carga; las dos leen el mismo archivo.
 */
export const importsRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.post('/workspaces/:workspaceId/import/preview', routeOptions, async (request, reply) => {
    const data = readBody(request, reply);
    if (!data) return reply;
    try {
      return await previewImport(app.db, request.membership!.workspaceId, data);
    } catch (error) {
      return importError(reply, error);
    }
  });

  app.post('/workspaces/:workspaceId/import/apply', routeOptions, async (request, reply) => {
    const data = readBody(request, reply);
    if (!data) return reply;
    const query = projectMetricsQuerySchema.safeParse(request.query);
    const today = (query.success && query.data.today) || defaultMetrics().today;
    try {
      return await applyImport(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        data,
        today,
      );
    } catch (error) {
      return importError(reply, error);
    }
  });

  done();
};
