import {
  canUpdateContainer,
  createPhaseSchema,
  MAX_PHASE_DEPTH,
  movePhaseSchema,
  renamePhaseSchema,
} from '@gestion/shared';
import { z } from 'zod';
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/session.js';
import { forbidden, requireMembership } from '../workspaces/access.js';
import { visibleContainer } from '../workspaces/facts.js';
import {
  createPhase,
  InvalidParentPhaseError,
  listPhases,
  movePhase,
  PhasesDisabledError,
  PhaseTooDeepError,
  renamePhase,
  softDeletePhase,
} from './phases.service.js';

const projectParamsSchema = z.object({ projectId: z.uuid() });
const phaseParamsSchema = z.object({ projectId: z.uuid(), phaseId: z.uuid() });

const BASE = '/workspaces/:workspaceId/projects/:projectId/phases';

function notFound(reply: FastifyReply, message: 'Proyecto no encontrado' | 'Fase no encontrada') {
  return reply.code(404).send({ message });
}

function phaseError(reply: FastifyReply, error: unknown) {
  if (error instanceof PhasesDisabledError) {
    return reply.code(409).send({ message: 'Este tipo de contenedor no usa fases' });
  }
  if (error instanceof InvalidParentPhaseError) {
    return reply.code(400).send({ message: 'La fase madre no existe en este proyecto' });
  }
  if (error instanceof PhaseTooDeepError) {
    return reply.code(400).send({ message: `Máximo ${MAX_PHASE_DEPTH} niveles de fases` });
  }
  throw error;
}

/**
 * Fases de un proyecto (HU-07). Las ve quien ve el contenedor; las crea, renombra, ordena y da de
 * baja quien puede modificar el contenedor (decisión del PO, ADR-0006)
 */
export const phasesRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('preHandler', requireAuth);

  async function findContainer(request: FastifyRequest) {
    const params = projectParamsSchema.safeParse(request.params);
    if (!params.success) return null;
    return visibleContainer(app.db, request.membership!, params.data.projectId);
  }

  /** La fase de la URL en un contenedor que la persona ve; si no puede modificarlo, 403 */
  async function editablePhase(request: FastifyRequest, reply: FastifyReply) {
    const params = phaseParamsSchema.safeParse(request.params);
    const container = params.success && (await findContainer(request));
    if (!params.success || !container) {
      void notFound(reply, 'Fase no encontrada');
      return null;
    }
    if (!canUpdateContainer(request.membership!, container)) {
      void forbidden(reply);
      return null;
    }
    return { workspaceId: request.membership!.workspaceId, ...params.data };
  }

  app.get(BASE, { preHandler: requireMembership }, async (request, reply) => {
    const container = await findContainer(request);
    if (!container) return notFound(reply, 'Proyecto no encontrado');
    return listPhases(app.db, request.membership!.workspaceId, container.id);
  });

  app.post(BASE, { preHandler: requireMembership }, async (request, reply) => {
    const container = await findContainer(request);
    if (!container) return notFound(reply, 'Proyecto no encontrado');
    if (!canUpdateContainer(request.membership!, container)) return forbidden(reply);
    const parsed = createPhaseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    try {
      const phase = await createPhase(
        app.db,
        request.auth!.userId,
        request.membership!.workspaceId,
        container.id,
        parsed.data,
      );
      return await reply.code(201).send(phase);
    } catch (error) {
      return phaseError(reply, error);
    }
  });

  app.patch(`${BASE}/:phaseId`, { preHandler: requireMembership }, async (request, reply) => {
    const where = await editablePhase(request, reply);
    if (!where) return reply;
    const parsed = renamePhaseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    const found = await renamePhase(app.db, request.auth!.userId, where, parsed.data.name);
    return found ? reply.code(204).send() : notFound(reply, 'Fase no encontrada');
  });

  app.post(`${BASE}/:phaseId/move`, { preHandler: requireMembership }, async (request, reply) => {
    const where = await editablePhase(request, reply);
    if (!where) return reply;
    const parsed = movePhaseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: z.prettifyError(parsed.error) });
    const found = await movePhase(app.db, request.auth!.userId, where, parsed.data);
    return found ? reply.code(204).send() : notFound(reply, 'Fase no encontrada');
  });

  // Dar de baja: la fase va a la papelera con sus subfases y sus tareas
  app.delete(`${BASE}/:phaseId`, { preHandler: requireMembership }, async (request, reply) => {
    const where = await editablePhase(request, reply);
    if (!where) return reply;
    const found = await softDeletePhase(app.db, request.auth!.userId, where);
    return found ? reply.code(204).send() : notFound(reply, 'Fase no encontrada');
  });

  done();
};
