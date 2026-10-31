import { projectMetricsQuerySchema } from '@gestion/shared';
import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { defaultMetrics } from '../projects/projects.service.js';
import { requireMembership } from '../workspaces/access.js';
import { exportCsv, exportFileName, exportJson } from './exports.service.js';

/** Fecha local del usuario para el nombre del archivo (?today=AAAA-MM-DD), o la del servidor */
function todayOf(request: FastifyRequest): string {
  const query = projectMetricsQuerySchema.safeParse(request.query);
  return (query.success && query.data.today) || defaultMetrics().today;
}

async function workspaceName(request: FastifyRequest): Promise<string> {
  const workspace = await request.server.db.workspace.findUniqueOrThrow({
    where: { id: request.membership!.workspaceId },
    select: { name: true },
  });
  return workspace.name;
}

/**
 * Exportar (HU-13): cualquier miembro descarga lo que puede ver (ADR-0006), sin lo de la papelera.
 * Se baja como archivo (Content-Disposition), así basta un enlace en la web.
 */
export const exportsRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(
    '/workspaces/:workspaceId/export.json',
    { preHandler: requireMembership },
    async (request, reply) => {
      const name = await workspaceName(request);
      const data = await exportJson(app.db, request.membership!, name);
      return reply
        .header(
          'Content-Disposition',
          `attachment; filename="${exportFileName(name, todayOf(request), 'json')}"`,
        )
        .type('application/json; charset=utf-8')
        .send(JSON.stringify(data, null, 2));
    },
  );

  app.get(
    '/workspaces/:workspaceId/export.csv',
    { preHandler: requireMembership },
    async (request, reply) => {
      const name = await workspaceName(request);
      return reply
        .header(
          'Content-Disposition',
          `attachment; filename="${exportFileName(name, todayOf(request), 'csv')}"`,
        )
        .type('text/csv; charset=utf-8')
        .send(await exportCsv(app.db, request.membership!));
    },
  );

  done();
};
