import {
  createDetailFieldSchema,
  moveDetailFieldSchema,
  updateDetailFieldSchema,
} from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { requirePermission } from '../workspaces/access.js';
import {
  createDetailField,
  DuplicateFieldNameError,
  InvalidFieldOwnerError,
  listDetailFields,
  moveDetailField,
  OptionsNotAllowedError,
  RemovedOptionError,
  updateDetailField,
} from './detail-fields.service.js';

const fieldParamsSchema = z.object({ fieldId: z.uuid() });

const BASE = '/workspaces/:workspaceId/detail-fields';

function fieldNotFound(reply: FastifyReply) {
  return reply.code(404).send({ message: 'Campo no encontrado' });
}

/** Traduce los errores del servicio a respuestas HTTP */
function fieldError(reply: FastifyReply, error: unknown) {
  if (error instanceof InvalidFieldOwnerError) {
    return reply.code(400).send({ message: 'El tipo no existe en este espacio' });
  }
  if (error instanceof OptionsNotAllowedError) {
    return reply.code(400).send({ message: 'Solo las listas llevan opciones' });
  }
  if (error instanceof DuplicateFieldNameError) {
    return reply.code(409).send({ message: 'Ese tipo ya tiene un campo con ese nombre' });
  }
  if (error instanceof RemovedOptionError) {
    return reply.code(409).send({
      message: `No se pueden quitar opciones (${error.options.join(', ')}): puede haber valores que las usan. Archiva el campo y crea otro.`,
    });
  }
  throw error;
}

/**
 * Campos de detalle por tipo (HU-23, ADR-0004 §3). Los ve quien ve proyectos (los formularios los
 * necesitan); los define el Admin, como los catálogos de tipos.
 */
export const detailFieldsRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  app.get(BASE, { preHandler: requirePermission('project.read') }, async (request) =>
    listDetailFields(app.db, request.membership!.workspaceId),
  );

  app.post(BASE, { preHandler: requirePermission('catalog.manage') }, async (request, reply) => {
    const parsed = createDetailFieldSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    }
    const workspaceId = request.membership!.workspaceId;
    try {
      await createDetailField(app.db, request.auth!.userId, workspaceId, parsed.data);
    } catch (error) {
      return fieldError(reply, error);
    }
    return reply.code(201).send(await listDetailFields(app.db, workspaceId));
  });

  app.patch(
    `${BASE}/:fieldId`,
    { preHandler: requirePermission('catalog.manage') },
    async (request, reply) => {
      const params = fieldParamsSchema.safeParse(request.params);
      if (!params.success) return fieldNotFound(reply);
      const parsed = updateDetailFieldSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      const workspaceId = request.membership!.workspaceId;
      try {
        const found = await updateDetailField(
          app.db,
          request.auth!.userId,
          workspaceId,
          params.data.fieldId,
          parsed.data,
        );
        if (!found) return fieldNotFound(reply);
      } catch (error) {
        return fieldError(reply, error);
      }
      return listDetailFields(app.db, workspaceId);
    },
  );

  app.post(
    `${BASE}/:fieldId/move`,
    { preHandler: requirePermission('catalog.manage') },
    async (request, reply) => {
      const params = fieldParamsSchema.safeParse(request.params);
      if (!params.success) return fieldNotFound(reply);
      const parsed = moveDetailFieldSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: z.prettifyError(parsed.error) });
      }
      const workspaceId = request.membership!.workspaceId;
      const found = await moveDetailField(
        app.db,
        request.auth!.userId,
        workspaceId,
        params.data.fieldId,
        parsed.data,
      );
      if (!found) return fieldNotFound(reply);
      return listDetailFields(app.db, workspaceId);
    },
  );

  done();
};
